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
        print("error on query: " + query)
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
        taxi_id = cursor.lastrowid
    except Exception,e:
        print("error on query: " + query)
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
    except Exception,e:
        print("error on query: " + query)
    cursor.close()
    cnx.close()    
    return taxi_id

def add_phone(mac_addr):
    phone_id = 0
    cnx = get_connection()
    cursor = cnx.cursor()
    query = "INSERT INTO data_phone (mac) VALUES (%(mac_addr)s)"
    parameters = { 'mac_addr': mac_addr }
    try:
        cursor.execute(query, parameters)
        cnx.commit()
        phone_id = cursor.lastrowid
    except Exception,e:
        print("error on query: " + query)
    cursor.close()
    cnx.close()    
    return phone_id

def get_phone(mac_addr):
    phone_id = 0
    cnx = get_connection()
    cursor = cnx.cursor()
    query = "SELECT id FROM data_phone WHERE mac = %(mac_addr)s LIMIT 1"
    parameters = { 'mac_addr': mac_addr }
    try:
        cursor.execute(query, parameters)
        for (id) in cursor:
            phone_id = id[0]
    except Exception,e:
        print("error on query: " + query)
    cursor.close()
    cnx.close()    
    return phone_id

def add_session(driver_id, taxi_id, phone_id):
    session_id = 0
    cnx = get_connection()
    cursor = cnx.cursor()
    query = "INSERT INTO data_session (driver_id, taxi_id, phone_id, start_time, end_time) VALUES (%(driver_id)s, %(taxi_id)s, %(phone_id)s, %(start_time)s, %(end_time)s)"
    parameters = { 'taxi_id': str(taxi_id), 'driver_id': str(driver_id), 'phone_id': str(phone_id), 'start_time': datetime.datetime.now(), 'end_time': datetime.datetime.now() }
    try:
        cursor.execute(query, parameters)
        cnx.commit()
        session_id = cursor.lastrowid
    except Exception,e:
        print("error on query: " + query)
    cursor.close()
    cnx.close()    
    return session_id

def get_session(driver_id, taxi_id, phone_id):
    session_id = 0
    cnx = get_connection()
    cursor = cnx.cursor()
    query = "SELECT id FROM data_session WHERE taxi_id = %(taxi_id)s AND driver_id = %(driver_id)s AND phone_id = %(phone_id)s AND end_time > DATE_SUB(NOW(), INTERVAL 1 MINUTE) ORDER BY end_time DESC LIMIT 1"
    parameters = { 'taxi_id': str(taxi_id), 'driver_id': str(driver_id), 'phone_id': str(phone_id) }
    try:
        cursor.execute(query, parameters)
        for (id) in cursor:
            session_id = id[0]
            query = "UPDATE data_session SET end_time = %(end_time)s WHERE id = %(session_id)s"
            parameters = { 'end_time': datetime.datetime.now(), 'session_id': session_id }
            cursor.execute(query, parameters)
            cnx.commit()
    except Exception,e:
        print("error on query: " + query)
    cursor.close()
    cnx.close()    
    return session_id

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
        phone_id = get_phone(taxi['phone'])
        if phone_id <= 0:
            phone_id = add_phone(taxi['phone'])
        session_id = get_session(driver_id, taxi_id, phone_id)
        if session_id <= 0:
            session_id = add_session(driver_id, taxi_id, phone_id)
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