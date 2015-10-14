from django.shortcuts import render
from django.views import generic
from data.models import Position
from data.models import Driver
from data.models import Taxi
from data.models import Session

class MenuView(generic.list.ListView):
    # model = Position
    template_name = "data/position_list.html"
    def get_queryset(self):
        queryset = []
        for taxi in Taxi.objects.all():
            try:
                session = Session.objects.filter(taxi=taxi).latest('startTime')
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
    template_name = "data/driver_json.html"
    def get_queryset(self):
        queryset = Driver.objects.exclude(firstname='', lastname='').exclude(token='')
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
    template_name = "data/path_json.html"
    def get_queryset(self):
        queryset = Position.objects.filter(taxi_id=self.kwargs['taxi_id']).filter(time__range=[self.kwargs['start_time'], self.kwargs['end_time']])
        return queryset

