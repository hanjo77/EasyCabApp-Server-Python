import json
import datetime
from django.core import serializers
from django.shortcuts import render
from django.views import generic
from data.models import Position
from data.models import Driver
from data.models import Taxi
from data.models import Phone
from data.models import Session
from data.models import AppConfig
from django import http

class JSONListMixin(object):
    def get(self, request, *args, **kwargs):
        raw_data = serializers.serialize('python', self.get_queryset())
        return http.HttpResponse(json.dumps([d['fields'] for d in raw_data]))

class JSONDetailMixin(object):
    def get(self, request, *args, **kwargs):
        raw_data = serializers.serialize('python', self.get_queryset())
        return http.HttpResponse(json.dumps([d['fields'] for d in raw_data][0]))

class MenuView(generic.list.ListView):
    template_name = "data/position_list.html"
    def get_queryset(self):
        queryset = []
        for taxi in Taxi.objects.all():
            try:
                session = Session.objects.filter(
                    taxi=taxi
                )
                queryset.append(Position.objects.filter(
                    session=session
                ).latest('time'))
            except:
                return []
        return queryset

class DriverSelectionView(generic.list.ListView):
    def get_queryset(self):
        queryset = Driver.objects.exclude(
            firstname='', 
            lastname=''
        )
        return queryset

class PhoneJsonView(JSONListMixin, generic.list.ListView):
    def get_queryset(self):
        queryset = Phone.objects.all()
        return queryset

class AppConfigJsonView(JSONDetailMixin, generic.DetailView):
    def get_queryset(self):
        queryset = AppConfig.objects.all()
        return queryset

class DriverJsonView(generic.View):
    def get(self, request, *args, **kwargs):
        queryset = Driver.objects.all()
        raw_data = serializers.serialize('python', queryset)
        return http.HttpResponse(json.dumps([{d['fields']['token']: d['fields']['firstname']+" "+d['fields']['lastname']} for d in raw_data]))

class SessionDataJsonView(generic.View):
    def date_handler(self, obj):
        return obj.isoformat() if hasattr(obj, 'isoformat') else obj
    def get(self, request, *args, **kwargs):
        queryset = Session.objects.filter(pk=self.kwargs['pk'])
        print queryset
        raw_data = serializers.serialize('python', queryset)
        return http.HttpResponse(json.dumps([( d['fields'] ) for d in raw_data], default=self.date_handler))

class SessionJsonView(generic.View):
    def date_handler(self, obj):
        return obj.isoformat() if hasattr(obj, 'isoformat') else obj
    def get(self, request, *args, **kwargs):
        try:
            timeout = datetime.datetime.now() - datetime.timedelta(minutes=1)
            taxi_name = self.kwargs['taxi']
            driver_token = self.kwargs['driver']
            phone_mac_addr = self.kwargs['phone']
            session_id = (Session.objects.filter(
                taxi__name=taxi_name
            ).filter(
                driver__token=driver_token
            ).filter(
                phone__mac=phone_mac_addr
            ).filter(
                end_time__gte=timeout
            ).latest('end_time')).pk
        except:
            session = Session(
                driver_id=Driver.objects.filter(token=driver_token).first().pk,
                taxi_id=Taxi.objects.filter(name=taxi_name).first().pk,
                phone_id=Phone.objects.filter(mac=phone_mac_addr).first().pk,
                start_time=datetime.datetime.now(),
                end_time=datetime.datetime.now()
            )
            session.save()
            session_id = session.pk
            print session_id
        config_data = serializers.serialize('python', [AppConfig.objects.last()])
        return http.HttpResponse(json.dumps({
            'session_id': session_id,
            'config': config_data[0]['fields']
            }, default=self.date_handler))

class DriverChangeView(generic.View):
    def get(self, request, *args, **kwargs):
        try:
            taxi = self.kwargs['taxi']
            driver_id_old = self.kwargs['driver_id_old']
            driver_id_new = self.kwargs['driver_id_new']
            Session.objects.filter(
                driver_id=driver_id_old
            ).update(
                driver_id=driver_id_new
            )
            return http.HttpResponse("OK")
        except:
            return http.HttpResponse("Fail")

class PathView(generic.View):
    def date_handler(self, obj):
        return obj.isoformat() if hasattr(obj, 'isoformat') else obj
    def get(self, request, *args, **kwargs):
        current_session = Session.objects.filter(taxi_id=self.kwargs['taxi_id'])
        queryset = Position.objects.all().filter(
            session=current_session
        ).filter(
            time__range=[self.kwargs['start_time'], self.kwargs['end_time']]
        )
        raw_data = serializers.serialize('python', queryset)
        return http.HttpResponse(json.dumps([{
            'lat':d['fields']['latitude'],
            'lng':d['fields']['longitude']
            } for d in raw_data], default=self.date_handler))

