from django.db import models
from django.utils import timezone

class Driver(models.Model):
    firstname = models.CharField(max_length=255)
    lastname = models.CharField(max_length=255)
    token = models.CharField(max_length=255)
    def __unicode__(self):
       return unicode(self.firstname + " " + self.lastname)

class Taxi(models.Model):
    name = models.CharField(max_length=255)
    def __unicode__(self):
       return unicode(self.name)

class Phone(models.Model):
    mac = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    number = models.CharField(max_length=255)
    def __unicode__(self):
       return unicode(self.name + " (" + self.number + ")")

class Session(models.Model):
    driver = models.ForeignKey(Driver)
    taxi = models.ForeignKey(Taxi)
    phone = models.ForeignKey(Phone)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(auto_now_add=True)

class Position(models.Model):
    session = models.ForeignKey(Session)
    latitude = models.FloatField()
    longitude = models.FloatField()
    time = models.DateTimeField(auto_now_add=True)

class AppConfig(models.Model):
    position_update_interval = models.IntegerField()
    maximal_data_storage_days = models.IntegerField()
    def get_model_fields(self):
        return self._meta.fields