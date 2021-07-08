from channels.generic.websocket import AsyncWebsocketConsumer
import json
from channels.db import database_sync_to_async
from createTeams.models import Team_Messages, Organization
from django.contrib.auth import get_user_model
User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):

    @database_sync_to_async
    def fetch_messages(self, data):
        print("fetch")
        messages = Team_Messages.last_20_messages(data['team_id'])
        print("messages:",messages)
        content = {
            'command': 'messages',
            'messages': self.messages_to_json(messages),
            'path':'fetch',
        }
        return content


    @database_sync_to_async
    def new_message(self, data):
        print("new")
        author = data['from']
        team_id = data['team_id']
        author_user = User.objects.filter(username = author)[0]
        room = Organization.objects.filter(pk = team_id)[0]
        message = Team_Messages.objects.create(user = author_user, team = room, content = data['message'])
        content = {
            'command': 'new_message',
            'message': self.message_to_json(message)
        }
        return content

    def messages_to_json(self, messages):
        result = []
        for message in messages:
            result.append(self.message_to_json(message))
        return result

    def message_to_json(self, message):
        return {
            'user': message.user.username,
            'content': message.content,
            'timestamp': str(message.timestamp)
        }

    commands = {
        'fetch_messages': fetch_messages,
        'new_message': new_message,
    }

    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = 'chat_%s' % self.room_id
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self,close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )
    
    async def receive(self,text_data):
        # json.loads takes string and converts it to python dictionary
        receive_dict = json.loads(text_data)
        if receive_dict.get('command') is not None:
            content = await self.commands[receive_dict['command']](self, receive_dict)
            receive_dict['command'] = content['command']
            if content['command']=='messages':
                receive_dict['messages'] = content['messages']
            else:
                receive_dict['message'] = content['message']

        receive_dict['call_message']['receiver_channel_name']=self.channel_name
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type':'send.sdp',
                'receive_dict': receive_dict
            }
        )

    async def send_chat_message(self,message):
        # Send message to room group
        await(self.channel_layer.group_send)(
            self.room_group_name,
            {
                'type': 'send.sdp',
                'receive_dict': message
            }
        )

    async def send_sdp(self,event):
        receive_dict = event['receive_dict']
        await self.send(text_data=json.dumps(receive_dict)) # converts object to a string
