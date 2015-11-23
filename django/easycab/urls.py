"""easycab URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/1.8/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  url(r'^$', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  url(r'^$', Home.as_view(), name='home')
Including another URLconf
    1. Add an import:  from blog import urls as blog_urls
    2. Add a URL to urlpatterns:  url(r'^blog/', include(blog_urls))
"""
from django.conf.urls import include, url
from django.contrib import admin
from data import views
from django.views.generic import TemplateView

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^admin/position_export_filter', views.PositionExportFilterView.as_view(), name='position_export_filter'),
    url(r'^admin/driver_filter', views.DriverFilterView.as_view(), name='driver_filter'),
    url(r'^admin/taxi_filter', views.TaxiFilterView.as_view(), name='taxi_filter'),
    url(r'^admin/date_filter', views.DateFilterView.as_view(), name='date_filter'),
    url(r'^admin/position_export', views.PositionExportCsvView.as_view(), name='position_export'),
    url(r'^session_data/(?P<pk>[0-9]*)', views.SessionDataJsonView.as_view(), name='session_data'),
    url(r'^session/(?P<phone>[^\/]*)/(?P<taxi>[^\/]*)/(?P<driver>[^\/]*)', views.SessionJsonView.as_view(), name='session'),
    url(r'^app_config/(?P<pk>[0-9]*)', views.AppConfigJsonView.as_view(), name='app_config'),
    url(r'^menu/(?P<taxi>.*)', views.MenuView.as_view(), name='menu'),
    url(r'^menu', views.MenuView.as_view(), name='menu'),
    url(r'^drivers', views.DriverSelectionView.as_view(), name='driver_selection'),
    url(r'^json_data', views.DataJsonView.as_view(), name='json_data'),
    url(r'^validate_token/(?P<token>[^\/]*)/', views.TokenValidateJsonView.as_view(), name='validate_token'),
    url(r'^validate_phone/(?P<mac>[^\/]*)/', views.PhoneValidateJsonView.as_view(), name='validate_phone'),
    url(r"^map_marker/", include("markers.urls")),
    url(r'^driver_change/(?P<taxi>[^\/]*)/(?P<driver_id>[0-9]*)', views.DriverChangeView.as_view(), name='driver_change'),
    url(r'^path/(?P<start_time>[0-9,\-,\:,\ ]*)/(?P<end_time>[0-9,\-,\:,\ ]*)/(?P<taxi_id>[0-9]*)', views.PathView.as_view(), name='driver_change'),
    url(r'^$', TemplateView.as_view(template_name="index.html"), name='index'),
]
