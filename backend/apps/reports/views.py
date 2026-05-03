"""
apps/reports/views.py
=====================
All reports for Taurus Trade & Logistics ERP.
Every report supports:
  • JSON  (default)
  • PDF   (?format=pdf)
  • Excel (?format=excel)
"""
from io import BytesIO
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, Count, Q, F, Value
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response


# ── Shared helpers ────────────────────────────────────────────────────────────

def _parse_date_range(request, default_days=30):
    today     = date.today()
    date_from = request.query_params.get('date_from') or str(today - timedelta(days=default_days))
    date_to   = request.query_params.get('date_to')   or str(today)
    return date_from, date_to


def _excel_response(filename: str):
    """Return an HttpResponse pre-configured for .xlsx streaming."""
    r = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    r['Content-Disposition'] = f'attachment; filename="{filename}"'
    return r


def _pdf_response(filename: str):
    r = HttpResponse(content_type='application/pdf')
    r['Content-Disposition'] = f'attachment; filename="{filename}"'
    return r


# ══════════════════════════════════════════════════════════════════════════════
#   EXCEL BUILDER (Professional styled workbooks)
# ══════════════════════════════════════════════════════════════════════════════

def build_excel(title: str, headers: list, rows: list, summary: dict = None) -> BytesIO:
    """
    Build a professional Excel workbook.
    Returns a BytesIO buffer ready for HttpResponse.
    """
    import openpyxl
    from openpyxl.styles import (Font, PatternFill, Alignment, Border, Side,
                                  GradientFill)
    from openpyxl.utils import get_column_letter

    NAVY   = '001219'
    BLUE   = '006ba6'
    SKY    = '0496ff'
    AMBER  = 'ffbc42'
    WHITE  = 'FFFFFF'
    LIGHT  = 'f0f4f8'
    BORDER_COLOR = 'e1e8f0'

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = title[:31]

    thin = Side(style='thin', color=BORDER_COLOR)
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    # ── Row 1: Company Banner ─────────────────────────────────────────────────
    ws.row_dimensions[1].height = 36
    ws.merge_cells(f'A1:{get_column_letter(len(headers))}1')
    banner = ws['A1']
    banner.value = 'TAURUS TRADE & LOGISTICS ERP'
    banner.font  = Font(name='Calibri', size=16, bold=True, color=WHITE)
    banner.fill  = PatternFill('solid', fgColor=NAVY)
    banner.alignment = Alignment(horizontal='center', vertical='center')

    # ── Row 2: Report Title ───────────────────────────────────────────────────
    ws.row_dimensions[2].height = 24
    ws.merge_cells(f'A2:{get_column_letter(len(headers))}2')
    rep_title = ws['A2']
    rep_title.value = title.upper()
    rep_title.font  = Font(name='Calibri', size=12, bold=True, color=WHITE)
    rep_title.fill  = PatternFill('solid', fgColor=BLUE)
    rep_title.alignment = Alignment(horizontal='center', vertical='center')

    # ── Row 3: Generated on ───────────────────────────────────────────────────
    ws.row_dimensions[3].height = 16
    ws.merge_cells(f'A3:{get_column_letter(len(headers))}3')
    gen = ws['A3']
    gen.value = f'Generated: {date.today().strftime("%d/%m/%Y")}   |   Currency: GH₵ (Ghana Cedi)'
    gen.font  = Font(name='Calibri', size=9, italic=True, color='64748b')
    gen.alignment = Alignment(horizontal='right', vertical='center')

    # ── Row 4: blank spacer ───────────────────────────────────────────────────
    ws.row_dimensions[4].height = 8

    # ── Row 5: Column headers ─────────────────────────────────────────────────
    ws.row_dimensions[5].height = 22
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=5, column=col_idx, value=header)
        cell.font      = Font(name='Calibri', size=10, bold=True, color=WHITE)
        cell.fill      = PatternFill('solid', fgColor=SKY)
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border    = border

    # ── Data rows ─────────────────────────────────────────────────────────────
    for row_idx, row in enumerate(rows, 6):
        ws.row_dimensions[row_idx].height = 18
        alt_fill = PatternFill('solid', fgColor=LIGHT) if row_idx % 2 == 0 else None
        for col_idx, val in enumerate(row, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font   = Font(name='Calibri', size=10)
            cell.border = border
            if alt_fill:
                cell.fill = alt_fill
            # Right-align numeric columns
            if isinstance(val, (int, float, Decimal)):
                cell.alignment = Alignment(horizontal='right', vertical='center')
                if isinstance(val, (float, Decimal)):
                    cell.number_format = '#,##0.00'
            else:
                cell.alignment = Alignment(vertical='center', wrap_text=False)

    # ── Summary section ───────────────────────────────────────────────────────
    if summary:
        summary_start = len(rows) + 7
        ws.row_dimensions[summary_start].height = 8
        for s_idx, (key, val) in enumerate(summary.items(), summary_start + 1):
            ws.row_dimensions[s_idx].height = 20
            lc  = get_column_letter(len(headers) - 1)
            vc  = get_column_letter(len(headers))
            lbl = ws[f'{lc}{s_idx}']
            amt = ws[f'{vc}{s_idx}']
            lbl.value = key
            lbl.font  = Font(name='Calibri', size=10, bold=True, color=WHITE)
            lbl.fill  = PatternFill('solid', fgColor=NAVY)
            lbl.alignment = Alignment(horizontal='right', vertical='center')
            lbl.border = border
            amt.value = val
            amt.font  = Font(name='Calibri', size=10, bold=True, color=WHITE)
            amt.fill  = PatternFill('solid', fgColor=NAVY)
            amt.alignment = Alignment(horizontal='right', vertical='center')
            amt.number_format = '#,##0.00'
            amt.border = border

    # ── Auto column widths ────────────────────────────────────────────────────
    for col_idx, header in enumerate(headers, 1):
        col_letter = get_column_letter(col_idx)
        max_len    = len(str(header)) + 4
        for row_idx in range(6, 6 + len(rows)):
            cell_val = ws.cell(row=row_idx, column=col_idx).value
            if cell_val:
                max_len = max(max_len, len(str(cell_val)) + 2)
        ws.column_dimensions[col_letter].width = min(max_len, 45)

    # ── Freeze pane below headers ─────────────────────────────────────────────
    ws.freeze_panes = 'A6'

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# ══════════════════════════════════════════════════════════════════════════════
#   PDF BUILDER (Professional branded pages)
# ══════════════════════════════════════════════════════════════════════════════

def build_pdf(title: str, headers: list, rows: list, summary: dict = None) -> BytesIO:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm

    NAVY  = colors.HexColor('#001219')
    BLUE  = colors.HexColor('#006ba6')
    SKY   = colors.HexColor('#0496ff')
    AMBER = colors.HexColor('#ffbc42')
    LIGHT = colors.HexColor('#f0f4f8')

    use_landscape = len(headers) > 6
    pagesize = landscape(A4) if use_landscape else A4

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=pagesize,
                             rightMargin=1.5*cm, leftMargin=1.5*cm,
                             topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    story  = []

    # Header block
    co_style = ParagraphStyle('co', fontSize=18, fontName='Helvetica-Bold',
                               textColor=NAVY, spaceAfter=2)
    rp_style = ParagraphStyle('rp', fontSize=13, fontName='Helvetica-Bold',
                               textColor=BLUE, spaceAfter=4)
    dt_style = ParagraphStyle('dt', fontSize=8, fontName='Helvetica',
                               textColor=colors.HexColor('#64748b'), spaceAfter=8)

    story.append(Paragraph("TAURUS TRADE & LOGISTICS", co_style))
    story.append(Paragraph(title.upper(), rp_style))
    story.append(Paragraph(f"Generated: {date.today().strftime('%d/%m/%Y')}   |   Currency: GH₵ (Ghana Cedi)", dt_style))
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=10))

    # Data table
    table_data = [headers] + [list(r) for r in rows]

    # Convert all values to strings for ReportLab
    def fmt(v):
        if isinstance(v, (float, Decimal)):
            return f"{float(v):,.2f}"
        return str(v) if v is not None else '—'

    table_data = [[fmt(c) for c in row] for row in table_data]

    col_count  = len(headers)
    page_width = (landscape(A4)[0] if use_landscape else A4[0]) - 3*cm
    col_w      = [page_width / col_count] * col_count

    tbl = Table(table_data, colWidths=col_w, repeatRows=1)
    tbl.setStyle(TableStyle([
        # Header row
        ('BACKGROUND',    (0,0),(-1,0),  BLUE),
        ('TEXTCOLOR',     (0,0),(-1,0),  colors.white),
        ('FONTNAME',      (0,0),(-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',      (0,0),(-1,0),  9),
        ('ALIGN',         (0,0),(-1,0),  'CENTER'),
        ('VALIGN',        (0,0),(-1,0),  'MIDDLE'),
        ('ROWHEIGHT',     (0,0),(-1,0),  18),
        # Data rows
        ('FONTNAME',      (0,1),(-1,-1), 'Helvetica'),
        ('FONTSIZE',      (0,1),(-1,-1), 8),
        ('VALIGN',        (0,1),(-1,-1), 'MIDDLE'),
        ('ROWHEIGHT',     (0,1),(-1,-1), 15),
        ('ROWBACKGROUNDS',(0,1),(-1,-1), [colors.white, LIGHT]),
        # Grid
        ('GRID',          (0,0),(-1,-1), 0.4, colors.HexColor('#e1e8f0')),
        ('LINEBELOW',     (0,0),(-1,0),  1.5, NAVY),
        ('TOPPADDING',    (0,0),(-1,-1), 4),
        ('BOTTOMPADDING', (0,0),(-1,-1), 4),
        ('LEFTPADDING',   (0,0),(-1,-1), 5),
    ]))
    story.append(tbl)

    # Summary
    if summary:
        story.append(Spacer(1, 0.5*cm))
        sum_data = [[k, f"GH₵ {float(v):,.2f}" if isinstance(v, (int, float, Decimal)) else str(v)]
                    for k, v in summary.items()]
        sum_tbl = Table(sum_data, colWidths=[page_width - 5*cm, 5*cm])
        sum_tbl.setStyle(TableStyle([
            ('BACKGROUND',  (0,0),(-1,-1), colors.HexColor('#f0f7ff')),
            ('FONTNAME',    (0,0),(0,-1),  'Helvetica-Bold'),
            ('FONTNAME',    (1,0),(1,-1),  'Helvetica-Bold'),
            ('FONTSIZE',    (0,0),(-1,-1), 9),
            ('TEXTCOLOR',   (0,0),(-1,-1), NAVY),
            ('ALIGN',       (1,0),(1,-1),  'RIGHT'),
            ('GRID',        (0,0),(-1,-1), 0.4, colors.HexColor('#e1e8f0')),
            ('TOPPADDING',  (0,0),(-1,-1), 5),
            ('BOTTOMPADDING',(0,0),(-1,-1),5),
        ]))
        story.append(sum_tbl)

    # Footer
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e1e8f0')))
    story.append(Paragraph(
        "Taurus Trade & Logistics ERP  |  Confidential  |  All amounts in Ghana Cedi (GH₵)",
        ParagraphStyle('footer', fontSize=7, textColor=colors.HexColor('#94a3b8'), alignment=1)
    ))

    doc.build(story)
    buf.seek(0)
    return buf


# ══════════════════════════════════════════════════════════════════════════════
#   REPORT VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class StockReportView(APIView):
    """
    Closing stock report.
    Qty = SUM(quantity), Value = SUM(final_amount) – purely from ledger.
    """
    def get(self, request):
        from apps.inventory.models import StockLedger
        date_from, date_to = _parse_date_range(request, 365)

        qs = (
            StockLedger.objects
            .filter(created_at__date__lte=date_to)
            .values('item__id', 'item__name', 'item__item_type', 'item__unit',
                    'location__name')
            .annotate(
                closing_qty   = Sum('quantity'),
                closing_value = Sum('final_amount'),
            )
            .order_by('item__name')
        )

        headers = ['Item', 'Type', 'Unit', 'Location', 'Closing Qty', 'Closing Value (GH₵)']
        rows    = [
            [r['item__name'], r['item__item_type'], r['item__unit'],
             r['location__name'],
             float(r['closing_qty']   or 0),
             float(r['closing_value'] or 0)]
            for r in qs
        ]
        total_value = sum(r[5] for r in rows)
        summary     = {'Total Stock Value (GH₵)': total_value}

        fmt = request.query_params.get('format', 'json')
        if fmt == 'excel':
            buf  = build_excel('Stock Report', headers, rows, summary)
            resp = _excel_response(f'stock_report_{date_to}.xlsx')
            resp.write(buf.read()); return resp
        if fmt == 'pdf':
            buf  = build_pdf('Stock Report', headers, rows, summary)
            resp = _pdf_response(f'stock_report_{date_to}.pdf')
            resp.write(buf.read()); return resp

        return Response({'headers': headers, 'rows': rows, 'summary': summary})


class SpareParts_ReportView(APIView):
    """Spare-parts movement report."""
    def get(self, request):
        from apps.inventory.models import StockLedger
        date_from, date_to = _parse_date_range(request)

        qs = (
            StockLedger.objects
            .filter(item__item_type='SPARE_PART',
                    created_at__date__range=[date_from, date_to])
            .values('item__name', 'transaction_type', 'location__name')
            .annotate(total_qty=Sum('quantity'), total_value=Sum('final_amount'))
            .order_by('item__name', 'transaction_type')
        )

        headers = ['Item', 'Transaction', 'Location', 'Total Qty', 'Total Value (GH₵)']
        rows    = [
            [r['item__name'], r['transaction_type'], r['location__name'],
             float(r['total_qty'] or 0), float(r['total_value'] or 0)]
            for r in qs
        ]
        total_value = sum(r[4] for r in rows if r[4] > 0)
        summary     = {'Total Purchases Value (GH₵)': total_value}

        fmt = request.query_params.get('format', 'json')
        if fmt == 'excel':
            buf = build_excel('Spare Parts Report', headers, rows, summary)
            resp = _excel_response(f'spare_parts_{date_to}.xlsx')
            resp.write(buf.read()); return resp
        if fmt == 'pdf':
            buf = build_pdf('Spare Parts Report', headers, rows, summary)
            resp = _pdf_response(f'spare_parts_{date_to}.pdf')
            resp.write(buf.read()); return resp

        return Response({'headers': headers, 'rows': rows, 'summary': summary})


class TyreReportView(APIView):
    """Tyre stock and mileage report."""
    def get(self, request):
        from apps.tyres.models import Tyre, TyreAssignment

        tyres = Tyre.objects.all().order_by('status', 'brand')
        headers = ['Serial No.', 'Brand', 'Model', 'Size', 'Status',
                   'Assigned Truck', 'Position', 'KM Used', 'Unit Cost (GH₵)']
        rows = []
        for t in tyres:
            a = t.current_assignment
            rows.append([
                t.serial_number, t.brand, t.model, t.size, t.status,
                a.truck.truck_number if a else '—',
                a.position           if a else '—',
                float(a.km_used or 0) if a and a.km_used else 0,
                float(t.unit_cost),
            ])

        total_cost = sum(r[8] for r in rows)
        fitted     = sum(1 for r in rows if r[4] == 'FITTED')
        summary    = {
            'Total Tyres': len(rows),
            'Fitted': fitted,
            'In Store': sum(1 for r in rows if r[4] == 'STORE'),
            'Total Value (GH₵)': total_cost,
        }

        fmt = request.query_params.get('format', 'json')
        if fmt == 'excel':
            buf = build_excel('Tyre Report', headers, rows, summary)
            resp = _excel_response('tyre_report.xlsx')
            resp.write(buf.read()); return resp
        if fmt == 'pdf':
            buf = build_pdf('Tyre Report', headers, rows, summary)
            resp = _pdf_response('tyre_report.pdf')
            resp.write(buf.read()); return resp

        return Response({'headers': headers, 'rows': rows, 'summary': summary})


class TripReportView(APIView):
    """Trip summary report."""
    def get(self, request):
        from apps.trips.models import Trip
        date_from, date_to = _parse_date_range(request)

        trips = (
            Trip.objects
            .filter(loading_time__date__range=[date_from, date_to])
            .select_related('truck', 'driver')
            .order_by('-loading_time')
        )

        headers = ['Waybill', 'Date', 'Truck', 'Driver', 'Route',
                   'Material', 'Loaded (T)', 'Delivered (T)', 'Diff (T)',
                   'Duration', 'Revenue (GH₵)', 'Status']
        rows = [
            [t.waybill_no,
             t.loading_time.strftime('%d/%m/%Y'),
             t.truck.truck_number,
             t.driver.name,
             f"{t.origin} → {t.destination}",
             t.material_type,
             float(t.loaded_qty),
             float(t.delivered_qty or 0),
             float(t.qty_difference or 0),
             t.duration_display or '—',
             float(t.trip_revenue or 0),
             t.status]
            for t in trips
        ]

        total_rev  = sum(r[10] for r in rows)
        total_tons = sum(r[7]  for r in rows)
        summary    = {
            'Total Trips':          len(rows),
            'Total Delivered (T)':  total_tons,
            'Total Revenue (GH₵)':  total_rev,
        }

        fmt = request.query_params.get('format', 'json')
        if fmt == 'excel':
            buf = build_excel(f'Trip Report {date_from} to {date_to}', headers, rows, summary)
            resp = _excel_response(f'trip_report_{date_from}_{date_to}.xlsx')
            resp.write(buf.read()); return resp
        if fmt == 'pdf':
            buf = build_pdf(f'Trip Report {date_from} to {date_to}', headers, rows, summary)
            resp = _pdf_response(f'trip_report_{date_from}_{date_to}.pdf')
            resp.write(buf.read()); return resp

        return Response({'headers': headers, 'rows': rows, 'summary': summary})


class FuelReportView(APIView):
    """Fuel consumption and excess report per truck."""
    def get(self, request):
        from apps.fuel.models import FuelLog
        date_from, date_to = _parse_date_range(request)

        qs = (
            FuelLog.objects
            .filter(date__range=[date_from, date_to])
            .values('truck__truck_number')
            .annotate(
                fill_count  = Count('id'),
                total_litres = Sum('litres'),
                total_limit  = Sum('fuel_limit'),
                total_excess = Sum('excess_fuel'),
                total_cost   = Sum('total_cost'),
            )
            .order_by('truck__truck_number')
        )

        headers = ['Truck', 'Fill Count', 'Total Litres', 'Total Limit (L)',
                   'Excess (L)', 'Total Cost (GH₵)', 'Efficiency %']
        rows = []
        for r in qs:
            litres = float(r['total_litres'] or 0)
            limit  = float(r['total_limit']  or 0)
            eff    = round((limit / litres * 100), 1) if litres > 0 else 100.0
            rows.append([
                r['truck__truck_number'],
                r['fill_count'],
                litres,
                limit,
                float(r['total_excess'] or 0),
                float(r['total_cost']   or 0),
                eff,
            ])

        total_cost   = sum(r[5] for r in rows)
        total_excess = sum(r[4] for r in rows)
        summary = {
            'Total Fuel Cost (GH₵)':  total_cost,
            'Total Excess Litres':     total_excess,
        }

        # Detail rows for excess incidents
        excess_qs = (
            FuelLog.objects
            .filter(date__range=[date_from, date_to], excess_fuel__gt=0)
            .select_related('truck', 'trip')
            .order_by('-date')
        )
        excess_rows = [
            [str(fl.date), fl.truck.truck_number, float(fl.fuel_limit),
             float(fl.litres), float(fl.excess_fuel), fl.remark]
            for fl in excess_qs
        ]

        fmt = request.query_params.get('format', 'json')
        if fmt == 'excel':
            import openpyxl
            from openpyxl.styles import Font, PatternFill, Alignment
            buf1 = build_excel(f'Fuel Summary {date_from} to {date_to}', headers, rows, summary)
            buf2 = build_excel('Fuel Excess Incidents',
                                ['Date','Truck','Limit (L)','Issued (L)','Excess (L)','Remark'],
                                excess_rows)
            # Merge both sheets into one workbook
            wb1 = openpyxl.load_workbook(buf1)
            wb2 = openpyxl.load_workbook(buf2)
            ws2 = wb2.active
            ws2.title = 'Excess Incidents'
            wb1.move_sheet(wb1.active, offset=0)
            # Copy sheet
            from openpyxl import load_workbook
            new_ws = wb1.create_sheet(title='Excess Incidents')
            for row in ws2.iter_rows():
                for cell in row:
                    new_ws.cell(row=cell.row, column=cell.column, value=cell.value)
            final_buf = BytesIO()
            wb1.save(final_buf)
            final_buf.seek(0)
            resp = _excel_response(f'fuel_report_{date_from}_{date_to}.xlsx')
            resp.write(final_buf.read()); return resp
        if fmt == 'pdf':
            buf = build_pdf(f'Fuel Report {date_from} to {date_to}', headers, rows, summary)
            resp = _pdf_response(f'fuel_report_{date_from}_{date_to}.pdf')
            resp.write(buf.read()); return resp

        return Response({
            'headers': headers, 'rows': rows, 'summary': summary,
            'excess_incidents': excess_rows,
        })


class RevenueExpenditureReportView(APIView):
    """Revenue vs Expenditure P&L report."""
    def get(self, request):
        from apps.finance.models import Revenue, Expenditure
        date_from, date_to = _parse_date_range(request)

        rev_qs = (
            Revenue.objects
            .filter(date__range=[date_from, date_to])
            .values('source')
            .annotate(total=Sum('amount'))
        )
        exp_qs = (
            Expenditure.objects
            .filter(date__range=[date_from, date_to])
            .values('category')
            .annotate(total=Sum('amount'))
        )

        total_rev = sum(r['total'] or 0 for r in rev_qs)
        total_exp = sum(e['total'] or 0 for e in exp_qs)
        net       = total_rev - total_exp

        headers = ['Category', 'Type', 'Amount (GH₵)']
        rows    = []
        for r in rev_qs:
            rows.append([r['source'], 'REVENUE', float(r['total'] or 0)])
        for e in exp_qs:
            rows.append([e['category'], 'EXPENDITURE', float(e['total'] or 0)])

        summary = {
            'Total Revenue (GH₵)':     float(total_rev),
            'Total Expenditure (GH₵)': float(total_exp),
            'Net Profit / Loss (GH₵)': float(net),
        }

        fmt = request.query_params.get('format', 'json')
        if fmt == 'excel':
            buf = build_excel(f'Revenue vs Expenditure {date_from} to {date_to}', headers, rows, summary)
            resp = _excel_response(f'pnl_{date_from}_{date_to}.xlsx')
            resp.write(buf.read()); return resp
        if fmt == 'pdf':
            buf = build_pdf(f'Revenue vs Expenditure {date_from} to {date_to}', headers, rows, summary)
            resp = _pdf_response(f'pnl_{date_from}_{date_to}.pdf')
            resp.write(buf.read()); return resp

        return Response({'headers': headers, 'rows': rows, 'summary': summary})


class VATReportView(APIView):
    """VAT input/output report for tax filing."""
    def get(self, request):
        from apps.inventory.models import StockLedger
        from apps.invoicing.models import Invoice
        date_from, date_to = _parse_date_range(request)

        # Input VAT (purchases)
        input_qs = (
            StockLedger.objects
            .filter(transaction_type='PURCHASE',
                    vat_applicable=True,
                    created_at__date__range=[date_from, date_to])
            .aggregate(
                base  = Sum('base_amount'),
                vat   = Sum('vat_amount'),
                total = Sum('final_amount'),
            )
        )
        # Output VAT (invoices)
        output_qs = (
            Invoice.objects
            .filter(vat_applicable=True,
                    invoice_date__range=[date_from, date_to])
            .aggregate(
                base  = Sum('subtotal'),
                vat   = Sum('vat_amount'),
                total = Sum('total_amount'),
            )
        )

        input_vat  = float(input_qs['vat']  or 0)
        output_vat = float(output_qs['vat'] or 0)
        vat_payable = output_vat - input_vat

        headers = ['Type', 'Base Amount (GH₵)', 'VAT Amount (GH₵)', 'Total (GH₵)']
        rows = [
            ['Input VAT (Purchases)',
             float(input_qs['base']  or 0), input_vat,  float(input_qs['total']  or 0)],
            ['Output VAT (Invoices)',
             float(output_qs['base'] or 0), output_vat, float(output_qs['total'] or 0)],
            ['VAT Payable (Output - Input)', '—', vat_payable, '—'],
        ]
        summary = {
            'Input VAT (GH₵)':   input_vat,
            'Output VAT (GH₵)':  output_vat,
            'VAT Payable (GH₵)': vat_payable,
        }

        fmt = request.query_params.get('format', 'json')
        if fmt == 'excel':
            buf = build_excel(f'VAT Report {date_from} to {date_to}', headers, rows, summary)
            resp = _excel_response(f'vat_report_{date_from}_{date_to}.xlsx')
            resp.write(buf.read()); return resp
        if fmt == 'pdf':
            buf = build_pdf(f'VAT Report {date_from} to {date_to}', headers, rows, summary)
            resp = _pdf_response(f'vat_report_{date_from}_{date_to}.pdf')
            resp.write(buf.read()); return resp

        return Response({'headers': headers, 'rows': rows, 'summary': summary})


class MaintenanceReportView(APIView):
    def get(self, request):
        from apps.maintenance.models import MaintenanceLog
        date_from, date_to = _parse_date_range(request)

        logs = (
            MaintenanceLog.objects
            .filter(service_date__range=[date_from, date_to])
            .select_related('truck', 'mechanic')
            .order_by('-service_date')
        )
        headers = ['Date', 'Truck', 'Type', 'Mechanic', 'Description',
                   'Labour (GH₵)', 'Parts (GH₵)', 'Total (GH₵)', 'Status']
        rows = [
            [str(l.service_date), l.truck.truck_number, l.maintenance_type,
             l.mechanic.name if l.mechanic else '—', l.description[:60],
             float(l.labour_cost), float(l.parts_cost), float(l.total_cost), l.status]
            for l in logs
        ]
        total_cost = sum(r[7] for r in rows)
        summary    = {
            'Total Jobs':         len(rows),
            'Total Cost (GH₵)':   total_cost,
        }

        fmt = request.query_params.get('format', 'json')
        if fmt == 'excel':
            buf = build_excel('Maintenance Report', headers, rows, summary)
            resp = _excel_response(f'maintenance_{date_from}_{date_to}.xlsx')
            resp.write(buf.read()); return resp
        if fmt == 'pdf':
            buf = build_pdf('Maintenance Report', headers, rows, summary)
            resp = _pdf_response(f'maintenance_{date_from}_{date_to}.pdf')
            resp.write(buf.read()); return resp

        return Response({'headers': headers, 'rows': rows, 'summary': summary})


class DashboardSummaryView(APIView):
    """KPI summary for the dashboard."""
    def get(self, request):
        from apps.trucks.models  import Truck
        from apps.drivers.models import Driver
        from apps.trips.models   import Trip
        from apps.fuel.models    import FuelLog
        from apps.finance.models import Revenue, Expenditure
        from apps.inventory.models import StockLedger
        from django.utils import timezone

        today  = timezone.now().date()
        month_start = today.replace(day=1)

        active_trucks   = Truck.objects.filter(status='ACTIVE').count()
        active_drivers  = Driver.objects.filter(status='ACTIVE').count()
        trips_this_month = Trip.objects.filter(loading_time__date__gte=month_start).count()
        ongoing_trips    = Trip.objects.filter(status__in=['EN_ROUTE','DELAYED']).count()

        revenue_month = Revenue.objects.filter(date__gte=month_start).aggregate(t=Sum('amount'))['t'] or 0
        expense_month = Expenditure.objects.filter(date__gte=month_start).aggregate(t=Sum('amount'))['t'] or 0
        net_month     = revenue_month - expense_month

        fuel_excess_month = FuelLog.objects.filter(date__gte=month_start, excess_fuel__gt=0).count()
        fuel_litres_month = FuelLog.objects.filter(date__gte=month_start).aggregate(t=Sum('litres'))['t'] or 0

        stock_value = (StockLedger.objects.aggregate(t=Sum('final_amount'))['t'] or 0)

        # Expiry alerts
        from apps.trucks.models import Truck as TruckModel
        alerts = []
        for t in TruckModel.objects.filter(status='ACTIVE'):
            alerts.extend(t.expiry_alerts())

        return Response({
            'fleet': {
                'active_trucks':  active_trucks,
                'active_drivers': active_drivers,
                'ongoing_trips':  ongoing_trips,
            },
            'this_month': {
                'trips':        trips_this_month,
                'revenue':      float(revenue_month),
                'expenditure':  float(expense_month),
                'net_profit':   float(net_month),
                'fuel_excess_events': fuel_excess_month,
                'fuel_litres':  float(fuel_litres_month),
            },
            'stock_value': float(stock_value),
            'expiry_alerts': alerts[:10],
        })
