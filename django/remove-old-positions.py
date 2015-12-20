#!/usr/bin/env python

import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'easycab.settings')
import django
django.setup()
from datetime import datetime, timedelta
from data.models import Position
from data.models import Session
from data.models import AppConfig

try:
    max_days = AppConfig.objects.first().maximal_data_storage_days
    time_threshold = datetime.now() - timedelta(days=max_days)
    sessions = Session.objects.filter(end_time__lt=time_threshold)
    positions = Position.objects.filter(session__in=sessions)
    positions.delete()
    sessions.delete()
    print "Positions and sessions older than " + str(max_days) + " days successfully removed!"

except Exception, e:
    print str(e)