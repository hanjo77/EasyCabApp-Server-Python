from django.shortcuts import render
from django.views import generic
import json
from data.models import Position
from data.models import Driver
from data.models import Taxi
from data.models import Phone
from data.models import Session
from data.models import AppConfig
from django import http

class JSONResponseMixin(object):
    def render_to_response(self, context):
        "Returns a JSON response containing 'context' as payload"
        return self.get_json_response(self.convert_context_to_json(context))

    def get_json_response(self, content, **httpresponse_kwargs):
        "Construct an `HttpResponse` object."
        return http.HttpResponse(content,
                                 content_type='application/json',
                                 **httpresponse_kwargs)

    def convert_context_to_json(self, context):
        "Convert the context dictionary into a JSON object"
        # Note: This is *EXTREMELY* naive; in reality, you'll need
        # to do much more complex handling to ensure that arbitrary
        # objects -- such as Django model instances or querysets
        # -- can be serialized as JSON.
        return json.dumps(list(context))

class MenuView(generic.list.ListView):
    # model = Position
    template_name = "data/position_list.html"
    def get_queryset(self):
        queryset = []
        for taxi in Taxi.objects.all():
            try:
                session = Session.objects.filter(taxi=taxi).latest('start_time')
                queryset.append(Position.objects.filter(session=session).latest('time'))
            except:
                # Don't worry, there might just be no session or position for this taxi yet
                return []
        return queryset

class DriverSelectionView(generic.list.ListView):
    # model = Position
    def get_queryset(self):
        queryset = Driver.objects.exclude(firstname='', lastname='')
        return queryset

class DriverJsonView(generic.list.ListView):
    # model = Position
    template_name = "data/json_driver.html"
    def get_queryset(self):
        queryset = Driver.objects.exclude(firstname='', lastname='').exclude(token='')
        return queryset

class PhoneJsonView(generic.list.ListView):
    # model = Position
    template_name = "data/json_phone.html"
    def get_queryset(self):
        queryset = Phone.objects.all()
        return queryset

class AppConfigJsonView(JSONResponseMixin, generic.detail.BaseDetailView):
    pass
    template_name = "data/json_phone.html"
    def get_queryset(self):
        queryset = AppConfig.objects.all()
        return queryset

class DriverChangeView(generic.TemplateView):
    # model = Position
    template_name = "data/driver_change.html"
    result = "";
    def get_context_data(self, **kwargs):
        try:
            taxi = self.kwargs['taxi']
            driver_id_old = self.kwargs['driver_id_old']
            driver_id_new = self.kwargs['driver_id_new']
            Position.objects.filter(driver_id=driver_id_old).update(driver_id=driver_id_new)
            self.kwargs["result"] = "OK"
        except:
            self.kwargs["result"] = "Fail"

class PathView(generic.list.ListView):
    # model = Position
    template_name = "data/json_path.html"
    def get_queryset(self):
        queryset = Position.objects.filter(taxi_id=self.kwargs['taxi_id']).filter(time__range=[self.kwargs['start_time'], self.kwargs['end_time']])
        return queryset

