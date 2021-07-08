from django.urls import path
from .views import *
app_name = 'video_call'
urlpatterns = [
    # path('<uuid:room_id>',main_view,name="main_view"),
    path('<int:team_id>/<uuid:room_id>',main_view,name="main_view"),
    path('<path:base_url>',invite_people,name="invite_people")
]