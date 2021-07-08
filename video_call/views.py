from django.shortcuts import render, redirect
from video_call.models import meetId
from django.contrib.auth.models import User
from authentication.models import Account
import uuid

# Create your views here.
# def main_view(request,room_id):
#     base_url =  "{0}://{1}{2}".format(request.scheme, request.get_host(), request.path)
#     if request.user.is_authenticated:   
#         room_id = room_id
#         user_id = request.user.id
#         user = User.objects.get(pk=user_id)
#         context = {'room_id':room_id,'user_id':user_id,'user':user,'base_url':base_url} 
#         return render(request,'video_call/final_video.html',context=context)
#     else:
#         return redirect('/')
    # return render(request,'chat/board.html',context=context)

def main_view(request,team_id,room_id):
    base_url =  "{0}://{1}{2}".format(request.scheme, request.get_host(), request.path)
    if request.user.is_authenticated:   
        room_id = room_id
        team_id = team_id
        user_id = request.user.id
        user = User.objects.get(pk=user_id)
        context = {'room_id':room_id,'user_id':user_id,'user':user,'base_url':base_url,'team_id':team_id} 
        return render(request,'video_call/final_video.html',context=context)
    else:
        return redirect('/')



# need to do implement this
def invite_people(request,base_url):
    print("base_url:",base_url)
    users = Account.objects.all()
    
    return redirect('/auth/login',{'users':users})