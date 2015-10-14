#!/usr/bin/env python
# -*- coding: utf-8 -*-  

import paho.mqtt.client as mqtt
import mysql.connector as mysql
import datetime
import json

def get_connection():
    return mysql.connect(user='easycab', password='raspberry', host='127.0.0.1', database='easycab')

def add_driver(token):
    driver_id = 0
    cnx = get_connection()
    cursor = cnx.cursor()
    query = "INSERT INTO data_driver (token) VALUES (%(token)s)"
    parameters = { 'token': token }
    try:
        cursor.execute(query, parameters)
        cnx.commit()
        driver_id = cursor.lastrowid
    except Exception,e:
        driver_id = 0
        print("error on query: " + query + " - " + token)
    cnx.commit()
    cursor.close()
    cnx.close()    
    return driver_id

def get_driver(token):
    driver_id = 0
    cnx = get_connection()
    cursor = cnx.cursor()
    query = "SELECT id FROM data_driver WHERE token = %(token)s"
    parameters = { 'token': token }
    try:
        cursor.execute(query, parameters)
        for (id) in cursor:
            print(id)
            driver_id = id[0]
        cnx.commit()
    except Exception,e:
        print("error on query: " + query)
    cursor.close()
    cnx.close()    
    return driver_id

def add_taxi(name):
    taxi_id = 0
    cnx = get_connection()
    cursor = cnx.cursor()
    query = "INSERT INTO data_taxi (name) VALUES (%(name)s)"
    parameters = { 'name': name }
    try:
        cursor.execute(query, parameters)
        cnx.commit()
    except Exception,e:
        print("error on query: " + query)
    cnx.commit()
    cursor.close()
    cnx.close()    
    return taxi_id

def get_taxi(name):
    taxi_id = 0
    cnx = get_connection()
    cursor = cnx.cursor()
    query = "SELECT id FROM data_taxi WHERE name = %(name)s"
    parameters = { 'name': name }
    try:
        cursor.execute(query, parameters)
        for (id) in cursor:
            taxi_id = id[0]
        cnx.commit()
    except Exception,e:
        print("error on query: " + query)
    cursor.close()
    cnx.close()    
    return taxi_id

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
        cnx = get_connection()
        cursor = cnx.cursor()
        driver_id = get_driver(taxi['driver'])
        if driver_id <= 0:
            driver_id = add_driver(taxi['driver'])
        taxi_id = get_taxi(taxi['car'])
        if taxi_id <= 0:
            taxi_id = add_taxi(taxi['car'])
        session_id = 0
        query = "SELECT id FROM data_session WHERE taxi_id = %(taxi_id)s AND driver_id = %(driver_id)s ORDER BY startTime DESC LIMIT 1"
        parameters = { 'taxi_id': str(taxi_id), 'driver_id': str(driver_id) }
        try:
            cursor.execute(query, parameters)
            for (id) in cursor:
                session_id = id[0]
            cnx.commit()
        except Exception,e:
            print("error on query: " + query)
        if session_id > 0:
            query = "INSERT INTO data_position (session_id, latitude, longitude, time) VALUES (%s, %s, %s, %s)"
            parameters = (str(session_id), str(taxi['gps']['latitude']), str(taxi['gps']['longitude']), datetime.datetime.now())
            try:
                cursor.execute(query, parameters)
                cnx.commit()
            except Exception,e:
                print("error on query: " + query)
        cursor.close()
        cnx.close()
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