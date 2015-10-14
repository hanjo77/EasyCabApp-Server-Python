from django.contrib import admin

from .models import Driver
from .models import Taxi
from .models import Phone

admin.site.register(Driver)
admin.site.register(Taxi)
admin.site.register(Phone)