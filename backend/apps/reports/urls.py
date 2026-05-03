from django.urls import path
from .views import (StockReportView, SpareParts_ReportView, TyreReportView,
                    TripReportView, FuelReportView, RevenueExpenditureReportView,
                    VATReportView, MaintenanceReportView, DashboardSummaryView)

urlpatterns = [
    path('dashboard/',        DashboardSummaryView.as_view(),        name='report-dashboard'),
    path('stock/',            StockReportView.as_view(),             name='report-stock'),
    path('spare-parts/',      SpareParts_ReportView.as_view(),       name='report-spares'),
    path('tyres/',            TyreReportView.as_view(),              name='report-tyres'),
    path('trips/',            TripReportView.as_view(),              name='report-trips'),
    path('fuel/',             FuelReportView.as_view(),              name='report-fuel'),
    path('revenue-expenditure/', RevenueExpenditureReportView.as_view(), name='report-pnl'),
    path('vat/',              VATReportView.as_view(),               name='report-vat'),
    path('maintenance/',      MaintenanceReportView.as_view(),       name='report-maintenance'),
]
