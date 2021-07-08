from django.conf.urls import url
from . import consumers

websocket_urlpatterns = [
    url(r'ws/video_call/(?P<team_id>[0-9A-Fa-f-]+)/(?P<room_id>[0-9A-Fa-f-]+)/$',consumers.ChatConsumer.as_asgi()),
]