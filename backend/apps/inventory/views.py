"""apps/inventory/views.py"""
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from .models import Item, Location, StockLedger, Purchase, IssueItem
from .serializers import (ItemSerializer, LocationSerializer, StockLedgerSerializer,
                           PurchaseSerializer, IssueItemSerializer, PurchasePreviewSerializer)
from .services import PurchaseService, IssueService, StockService


# ── Locations ─────────────────────────────────────────────────────────────────
class LocationListCreate(generics.ListCreateAPIView):
    queryset         = Location.objects.all()
    serializer_class = LocationSerializer


class LocationDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Location.objects.all()
    serializer_class = LocationSerializer


# ── Items ─────────────────────────────────────────────────────────────────────
class ItemListCreate(generics.ListCreateAPIView):
    queryset         = Item.objects.all()
    serializer_class = ItemSerializer
    search_fields    = ('name', 'item_type')
    filterset_fields = ('item_type',)

    def create(self, request, *args, **kwargs):
        # Extract opening stock parameters
        opening_qty = request.data.pop('opening_qty', None)
        unit_price = request.data.pop('unit_price', None)
        location_id = request.data.pop('location_id', None)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()

        # Create opening stock ledger entry if provided
        if opening_qty and unit_price and location_id:
            try:
                from decimal import Decimal
                from .models import Location
                loc = Location.objects.get(id=location_id)
                StockLedger.objects.create(
                    item=item,
                    location=loc,
                    transaction_type=StockLedger.OPENING,
                    quantity=Decimal(str(opening_qty)),
                    unit_price=Decimal(str(unit_price)),
                    created_by=request.user if request.user.is_authenticated else None,
                    remark='Initial Opening Stock'
                )
            except Exception as e:
                pass # Just skip if it fails, item is already created

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class ItemDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Item.objects.all()
    serializer_class = ItemSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Delete related stock ledger entries to bypass models.PROTECT
        from .models import StockLedger
        StockLedger.objects.filter(item=instance).delete()
        return super().destroy(request, *args, **kwargs)


# ── Stock Ledger (read-only list) ─────────────────────────────────────────────
class StockLedgerList(generics.ListAPIView):
    queryset         = StockLedger.objects.select_related('item', 'location', 'created_by')
    serializer_class = StockLedgerSerializer
    filterset_fields = ('item', 'location', 'transaction_type')
    search_fields    = ('item__name', 'reference_type')
    ordering_fields  = ('created_at',)


# ── Closing Stock Report ──────────────────────────────────────────────────────
class ClosingStockView(APIView):
    def get(self, request):
        item_id     = request.query_params.get('item')
        location_id = request.query_params.get('location')
        as_of       = request.query_params.get('as_of')
        data = StockService.get_closing_stock(item_id, location_id, as_of)
        return Response(list(data))


# ── Purchase ──────────────────────────────────────────────────────────────────
class PurchaseListCreate(generics.ListCreateAPIView):
    queryset         = Purchase.objects.select_related('supplier', 'item', 'location')
    serializer_class = PurchaseSerializer
    filterset_fields = ('supplier', 'item', 'location', 'purchase_date')
    search_fields    = ('invoice_number', 'item__name', 'supplier__name')

    def create(self, request, *args, **kwargs):
        try:
            purchase = PurchaseService.create_purchase(request.data, user=request.user)
            return Response(PurchaseSerializer(purchase).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PurchaseDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Purchase.objects.all()
    serializer_class = PurchaseSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Clean up ledger entries created by this purchase
        StockLedger.objects.filter(
            item=instance.item,
            reference_type='PURCHASE',
        ).filter(quantity=instance.quantity).delete()
        return super().destroy(request, *args, **kwargs)


# ── Purchase Preview (auto-calc endpoint) ─────────────────────────────────────
class PurchasePreviewView(APIView):
    """POST qty + unit_price + vat fields → returns computed amounts instantly."""
    def post(self, request):
        s = PurchasePreviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(s.validated_data)


# ── Issue ─────────────────────────────────────────────────────────────────────
class IssueListCreate(generics.ListCreateAPIView):
    queryset         = IssueItem.objects.select_related('item', 'location', 'truck')
    serializer_class = IssueItemSerializer
    filterset_fields = ('item', 'location', 'issue_type', 'truck')

    def create(self, request, *args, **kwargs):
        try:
            issue = IssueService.create_issue(request.data, user=request.user)
            return Response(IssueItemSerializer(issue).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class IssueDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset         = IssueItem.objects.all()
    serializer_class = IssueItemSerializer


# ── Available Stock Check ─────────────────────────────────────────────────────
@api_view(['GET'])
def available_stock(request):
    item_id     = request.query_params.get('item')
    location_id = request.query_params.get('location')
    if not item_id:
        return Response({'error': 'item param required'}, status=400)
    qty = StockService.get_available_qty(item_id, location_id)
    return Response({'available_qty': float(qty)})
