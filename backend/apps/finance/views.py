"""apps/finance/views.py"""
from rest_framework import generics
from .models import Expenditure, Revenue
from .serializers import ExpenditureSerializer, RevenueSerializer


class ExpenditureListCreate(generics.ListCreateAPIView):
    queryset         = Expenditure.objects.select_related('truck', 'vendor')
    serializer_class = ExpenditureSerializer
    filterset_fields = ('category', 'truck', 'date')
    search_fields    = ('description', 'reference', 'truck__truck_number')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ExpenditureDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Expenditure.objects.all()
    serializer_class = ExpenditureSerializer


class RevenueListCreate(generics.ListCreateAPIView):
    queryset         = Revenue.objects.select_related('invoice', 'trip')
    serializer_class = RevenueSerializer
    filterset_fields = ('source', 'date')
    search_fields    = ('description', 'reference')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class RevenueDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Revenue.objects.all()
    serializer_class = RevenueSerializer
