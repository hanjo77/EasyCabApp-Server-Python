#!/usr/bin/env python

import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'easycab.settings')
import django
from django.core import serializers
django.setup()
import paho.mqtt.client as mqtt
import datetime
import json
import logging
from data.models import Position
from data.models import Driver
from data.models import Taxi
from data.models import Phone
from data.models import Session
from data.models import AppConfig
from Crypto import Random
from Crypto.Cipher import AES
import base64

logging.basicConfig(level=logging.INFO,
    format='%(asctime)s %(name)-12s %(levelname)-8s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    filename='/var/log/easycabd.log',
    filemode='w')

class EasyCabListener(object):
    """ Constructor """
    def __init__(self):
        """ Initializes daemon """
        self.client = []

    def run(self):
        """ The main method """
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message

        self.client.connect('46.101.17.239', 1883, 10)
        self.client.loop_start()
        while True:
            pass

    def on_connect(self, client, userdata, flags, rc):
        """ The callback for when the client receives a CONNACK response from the server. """
        logging.info('Connected with result code '+str(rc))
        # Subscribing in on_connect() means that if we lose the connection and
        # reconnect then subscriptions will be renewed.
        client.subscribe('presence')

    def on_message(self, client, userdata, msg):
        """ The callback for when a PUBLISH message is received from the server. """
        data = json.loads(self.decrypt(msg.payload))
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
            message = self.encrypt(json.dumps({
                'car': session.taxi.token,
                'driver': driver,
                'phone': session.phone.mac,
                'gps': {
                    'latitude': position.latitude,
                    'longitude': position.longitude
                },
                'time': str(position.time.replace(microsecond=0))
            }))
            client.publish('position', message, qos=0, retain=True)
            logging.info(message + " published to 'position'")

        except Exception, e:
            logging.error(data)
            logging.error(str(e))

    def pad(self, data):
        """ Adds padding characters for encryption """
        length = 16 - (len(data) % 16)
        return data + chr(length)*length

    def unpad(self, data):
        """ Removes added padding characters for decryption """
        return data[:-ord(data[-1])]

    def encrypt(self, message):
        """ AES encrypts a string """
        IV = Random.new().read(16)
        aes = AES.new(AppConfig.objects.first().encryption_key, AES.MODE_CFB, IV, segment_size=128)
        return base64.b64encode(IV + aes.encrypt(self.pad(message)))

    def decrypt(self, encrypted):
        """ Decrypts an AES encrypted string """
        encrypted = base64.b64decode(encrypted)
        IV = encrypted[:16]
        aes = AES.new(AppConfig.objects.first().encryption_key, AES.MODE_CFB, IV, segment_size=128)
        return self.unpad(aes.decrypt(encrypted[16:]))

easyCabListener = EasyCabListener()
easyCabListener.run()