#!/usr/bin/env python
# -*- coding: utf-8 -*-  

import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "easycab.settings")
import django
django.setup()
import paho.mqtt.client as mqtt
import datetime
import json
from data.models import Position
from data.models import Driver
from data.models import Taxi
from data.models import Phone
from data.models import Session

def add_driver(token):
    driver = Driver(
        token=token
    )
    driver.save()
    return driver.id

def get_driver(token):
    return Driver.objects.filter(token=token)[0].id

def add_taxi(name):
    taxi = Taxi(
        name=name
    )
    taxi.save()
    return taxi.id

def get_taxi(name):
    return Taxi.objects.filter(name=name)[0].id

def add_phone(mac_addr):
    phone = Phone(
        mac=mac_addr
    )
    phone.save()
    return phone.id

def get_phone(mac_addr):
    return Phone.objects.filter(mac=mac_addr)[0].id

def add_session(driver_id, taxi_id, phone_id):
    session = Session(
        driver_id=driver_id,
        taxi_id=taxi_id,
        phone_id=phone_id,
        start_time=datetime.datetime.now(),
        end_time=datetime.datetime.now()
    )
    session.save()
    return session.id

def get_session(driver_id, taxi_id, phone_id):
    timeout = datetime.datetime.now() - datetime.timedelta(minutes=1)
    sessions = Session.objects.filter(end_time__gte=timeout).filter(driver_id=driver_id).filter(taxi_id=taxi_id).filter(phone_id=phone_id)
    if sessions.exists():
        session = sessions[0]
        session.end_time = datetime.datetime.now()
        session.save()
        return session.id
    else:
        return 0

# The callback for when the client receives a CONNACK response from the server.
def on_connect(client, userdata, flags, rc):
    print("Connected with result code "+str(rc))
    # Subscribing in on_connect() means that if we lose the connection and
    # reconnect then subscriptions will be renewed.
    client.subscribe("presence")

# The callback for when a PUBLISH message is received from the server.
def on_message(client, userdata, msg):
    taxi = json.loads(msg.payload)
    try:
        driver_id = get_driver(taxi['driver'])
        if driver_id <= 0:
            driver_id = add_driver(taxi['driver'])
        taxi_id = get_taxi(taxi['car'])
        if taxi_id <= 0:
            taxi_id = add_taxi(taxi['car'])
        phone_id = get_phone(taxi['phone'])
        if phone_id <= 0:
            phone_id = add_phone(taxi['phone'])
        session_id = get_session(driver_id, taxi_id, phone_id)
        if session_id <= 0:
            session_id = add_session(driver_id, taxi_id, phone_id)
        position = Position(
            session_id=session_id,
            latitude=taxi['gps']["latitude"],
            longitude=taxi['gps']["longitude"],
            time=datetime.datetime.now()
        )
        position.save()
    except AttributeError, e:
        print(taxi)
        print(str(e))

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

client.connect("46.101.17.239", 1883, 10)

# Blocking call that processes network traffic, dispatches callbacks and
# handles reconnecting.
# Other loop*() functions are available that give a threaded interface and a
# manual interface.
client.loop_forever()