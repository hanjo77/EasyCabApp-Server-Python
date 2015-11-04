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

class AppConfigJsonView(JSONDetailMixin, generic.DetailView):
    def get_queryset(self):
        queryset = AppConfig.objects.all()
        return queryset

class DataJsonView(generic.View):
    def get(self, request, *args, **kwargs):
        taxis = serializers.serialize('python', Taxi.objects.all())
        drivers = serializers.serialize('python', Driver.objects.all())
        phones = serializers.serialize('python', Phone.objects.all())
        raw_data = {
            'taxis': {
                str(data['fields']['token']): data['fields']['name'] 
                for data in taxis },
            'drivers': { 
                str(data['fields']['token']): data['fields']['firstname'] + " " + data['fields']['lastname'] 
                for data in drivers },
            'phones': { 
                str(data['fields']['mac']): data['fields'] 
                for data in phones },
        }
        return http.HttpResponse(json.dumps(raw_data))

class TokenValidateJsonView(generic.View):
    def get(self, request, *args, **kwargs):
        queryset = Driver.objects.filter(token=self.kwargs['token'])
        raw_data = {};
        if queryset.exists():
            raw_data['type'] = 'driver'
        else:
            queryset = Taxi.objects.filter(token=self.kwargs['token'])
            if queryset.exists():
                raw_data['type'] = 'taxi'
        raw_data['data'] = serializers.serialize('python', queryset)
        return http.HttpResponse(json.dumps(raw_data))

class PhoneValidateJsonView(generic.View):
    def get(self, request, *args, **kwargs):
        queryset = Phone.objects.filter(mac=self.kwargs['mac'])
        raw_data = {};
        if queryset.exists():
            raw_data = serializers.serialize('python', queryset)
        return http.HttpResponse(json.dumps([( d['fields'] ) for d in raw_data]))

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
        taxi_token = self.kwargs['taxi']
        driver_token = self.kwargs['driver']
        phone_mac_addr = self.kwargs['phone']
        session_id = 0
        try:
            timeout = datetime.datetime.now() - datetime.timedelta(minutes=1)
            session_id = (Session.objects.filter(
                taxi__token=taxi_token
            ).filter(
                phone__mac=phone_mac_addr
            ).filter(
                end_time__gte=timeout
            ).latest('end_time')).pk
        except:
            driver = Driver.objects.filter(token=driver_token)
            driver_id = None;
            if driver.exists():
                driver_id = driver.first().pk
            taxi = Taxi.objects.filter(token=taxi_token)
            taxi_id = None;
            obj = {}
            if taxi.exists():
                print taxi
                taxi_id = taxi.first().pk
                session = Session(
                    driver_id=driver_id,
                    taxi_id=taxi_id,
                    phone_id=Phone.objects.filter(mac=phone_mac_addr).first().pk,
                    start_time=datetime.datetime.now(),
                    end_time=datetime.datetime.now()
                )
                session.save()
                session_id = session.pk
                print session_id
        if session_id > 0:
            config_data = serializers.serialize('python', [AppConfig.objects.last()])
            obj = {
                'session_id': session_id,
                'config': config_data[0]['fields']
                }
        return http.HttpResponse(json.dumps(obj, default=self.date_handler))

class DriverChangeView(generic.View):
    def get(self, request, *args, **kwargs):
        try:
            taxi = Taxi.objects.filter(token=self.kwargs['taxi']).last()
            driver_id = self.kwargs['driver_id']
            session = Session.objects.filter(
                taxi_id=taxi.pk
            ).last()
            session.driver_id = driver_id
            session.save()
            return http.HttpResponse("OK")
        except Exception:
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

