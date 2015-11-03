#!/usr/bin/env python
# -*- coding: utf-8 -*-  

import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'easycab.settings')
import django
from django.core import serializers
django.setup()
import paho.mqtt.client as mqtt
import datetime
import json
from data.models import Position
from data.models import Driver
from data.models import Taxi
from data.models import Phone
from data.models import Session
from data.models import AppConfig

# The callback for when the client receives a CONNACK response from the server.
def on_connect(client, userdata, flags, rc):
    print('Connected with result code '+str(rc))
    # Subscribing in on_connect() means that if we lose the connection and
    # reconnect then subscriptions will be renewed.
    client.subscribe('presence')

# The callback for when a PUBLISH message is received from the server.
def on_message(client, userdata, msg):
    data = json.loads(msg.payload)
    print data
    try:
        session_id = data['session']
        position = Position(
            session_id=session_id,
            latitude=data['gps']['latitude'],
            longitude=data['gps']['longitude'],
            time=datetime.datetime.now()
        )
        position.save()
        session = Session.objects.filter(id=session_id).first()
        session.end_time = datetime.datetime.now()
        session.save()
        driver = '';
        if session.driver:
             driver = session.driver.token
        message = json.dumps({
            'car': session.taxi.token,
            'driver': driver,
            'phone': session.phone.mac,
            'gps': {
                'latitude': position.latitude,
                'longitude': position.longitude
            },
            'time': str(position.time.replace(microsecond=0))
        })
        client.publish('position', message, qos=0, retain=True)
        print message + " published to 'position'"
    except Exception, e:
        print str(e)

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
print "test"
client.connect('46.101.17.239', 1883, 10)

# Blocking call that processes network traffic, dispatches callbacks and
# handles reconnecting.
# Other loop*() functions are available that give a threaded interface and a
# manual interface.
client.loop_forever()
