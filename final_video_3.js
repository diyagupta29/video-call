console.log("in main.js");
var mapPeers = {};
videoExisting = [];
var webSocket;
var loc = window.location; 
var wsStart = 'ws://';
if(loc.protocol== 'https:'){
    wsStart = 'wss://';
}
var endPoint = wsStart + loc.host + '/ws' + loc.pathname + '/';
console.log('endpoint:',endPoint);
webSocket = new WebSocket(endPoint);


function sendSignal(action, call_message){
    console.log("inside sendSignal function")
    console.log("new-user joined:",user)
    console.log("action:",action)
    var jsonStr = JSON.stringify({
        'action':action,
        'call_message':call_message,
        'peer': user,
    })

    webSocket.send(jsonStr);
}

function webSocketOnMessage(event){
    var parseData = JSON.parse(event.data);
    var targetUsername = parseData['peer'];
    console.log(parseData)
    var command = null
    var action = null
    if("action" in parseData ){
        action = parseData['action'];
    }
    if("command" in parseData ){
        command = parseData['command'];
    }
    if(command === 'messages' && user==targetUsername){
        console.log("entered messages:",parseData['messages'])
        for(let i=0;i<parseData['messages'].length;i++){
            createMessage(parseData['messages'][i]);
        }
    }
    else if (command === 'new_message'){
        console.log(parseData)
        createMessage(parseData['message']);
    }  
    if( action!=null)
    {
        
        if(user == targetUsername) return ;
        var receiver_channel_name = parseData['call_message']['receiver_channel_name']
        if( action == 'new-peer') createOfferer(targetUsername, receiver_channel_name);
        else if(action == 'new-offer') createAnswerer(parseData);
        else if(action == 'new-answer') handleAnswerMsg(parseData);
        else if(action == 'new-ice-candidate') handleNewIceCandidate(parseData);
        else if(action == 'leave_meet') handleLeaveMeet(parseData);
    }
}

webSocket.addEventListener('open',(e)=>{
    console.log("connection opened");
    webSocket.send(JSON.stringify({
        'action':'new-peer',
        'command':'fetch_messages',
        'team_id': team_id,
        'call_message':{},
        'peer':user,
    }))
});
webSocket.addEventListener('message',webSocketOnMessage);
webSocket.addEventListener('close',(e)=>{
    console.log('connection closed');
});
webSocket.addEventListener('error',(e)=>{
    console.log("Error occured!");
});

const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = false;

var localStream = new MediaStream();
var remoteVideo;
const constraints = {
    'video': true,
    'audio':true,
};
var userMedia = navigator.mediaDevices.getUserMedia(constraints).then(stream => {
    localStream = stream;
    myVideo.id = user + '-video';
    addVideoStream(myVideo,localStream);
    videoExisting.push(user);
})
.catch(error => {
    console.log('Error accessing media devices',error);
})

function addVideoStream(video, stream){
    video.srcObject = stream;
    video.addEventListener('loadedmetadata',() => {
        video.play();
    })
    video.muted = false;
    videoGrid.append(video);
    return video;
}

function createOfferer(targetUsername, receiver_channel_name){
    console.log("inside offer function:",targetUsername)
    createPeerConnection(targetUsername, receiver_channel_name);
    myPeerConnection = mapPeers[targetUsername][0];
    addLocalStream(myPeerConnection);
}

async function createAnswerer(parseData){
    targetUsername = parseData['peer'];
    let desc = new RTCSessionDescription(parseData['call_message']['sdp']);
    createPeerConnection(targetUsername,parseData['call_message']['receiver_channel_name']);
    myPeerConnection = mapPeers[targetUsername][0]
    candidates = mapPeers[targetUsername][1]
    candidates.forEach(candidate => myPeerConnection.addIceCandidate(candidate))
    await myPeerConnection.setRemoteDescription(desc)
    .then(() => {
    return navigator.mediaDevices.getUserMedia({audio: true, video: true});
    })
    .then(stream => {
    stream.getTracks().forEach(track => myPeerConnection.addTrack(track, stream));
    return myPeerConnection.createAnswer();
    })
    await myPeerConnection.setLocalDescription();
    sendSignal("new-answer",{
        "sdp": myPeerConnection.localDescription,
        'receiver_channel_name': parseData['call_message']['receiver_channel_name'],
    })
}

function addLocalStream(myPeerConnection){
    console.log("localstream:",localStream)
    localStream.getTracks().forEach(track => {
        myPeerConnection.addTrack(track, localStream);
    });
    return ;
}

function setRemoteVideoStream(myPeerConnection,targetUsername){
    var remoteVideo = createVideo(targetUsername);
    var remoteStream = new MediaStream();
    remoteVideo = addVideoStream(remoteVideo, remoteStream);
    myPeerConnection.addEventListener('track', async(event) => {
        remoteStream.addTrack(event.track, remoteStream);
    })
    console.log(remoteVideo)
    return remoteVideo;
}

function createVideo(targetUsername){
    var remoteVideo;
    if(videoExisting.includes(targetUsername))
    {
        const video_id = targetUsername + "-video";
        remoteVideo = document.getElementById(video_id);
    }
    else
    {
        remoteVideo = document.createElement('video');
        remoteVideo.id = targetUsername + '-video';
        remoteVideo.autoplay = true;
        remoteVideo.playsinline = true;
        videoExisting.push(targetUsername);
    }
    return remoteVideo;
}

function createPeerConnection(targetUsername, receiver_channel_name){
    var myPeerConnection = new RTCPeerConnection(null);
    myPeerConnection.onicecandidate = tmpIcefunc = e => handleICECandidateEvent(e, targetUsername);
    myPeerConnection.onnegotiationneeded = tmpfunc = e => handleNegotiationNeededEvent(e, targetUsername, receiver_channel_name);
    remoteVideo = setRemoteVideoStream(myPeerConnection,targetUsername);
    mapPeers[targetUsername] = [myPeerConnection,[]];
    myPeerConnection.addEventListener('iceconnectionstatechange',() => {
        var iceConnectionState = myPeerConnection.iceConnectionState;
        if(iceConnectionState==='failed' || iceConnectionState==='disconnected' || iceConnectionState==='closed')
        {
            delete mapPeers[targetUsername];
            if(iceConnectionState!='closed'){
                myPeerConnection.close();
            }
            removeVideo(remoteVideo);
            videoExisting = videoExisting.filter(i => i !== targetUsername);
        }
    })
}

async function handleNegotiationNeededEvent(event, targetUsername, receiver_channel_name) {
    myPeerConnection = mapPeers[targetUsername][0]
    await myPeerConnection.createOffer()
    await myPeerConnection.setLocalDescription();
    sendSignal('new-offer',{
        'sdp': myPeerConnection.localDescription,
        'receiver_channel_name': receiver_channel_name,
    });

}

function handleICECandidateEvent(event, targetUsername) {
    console.log("inside ice candidate event")
    console.log("candidate:",event.candidate)
    if (event.candidate) {
        sendSignal("new-ice-candidate",{
            'candidate': event.candidate,
        })
    }
}

async function handleAnswerMsg(parseData){
    console.log(parseData)
    let desc = new RTCSessionDescription(parseData['call_message']['sdp']);
    var myPeerConnection = mapPeers[parseData['peer']][0];
    if(!!!desc) return;
    await myPeerConnection.setRemoteDescription(desc);
    var candidates = mapPeers[parseData['peer']][1];
    candidates.forEach(candidate => myPeerConnection.addIceCandidate(candidate));
}

function handleNewIceCandidate(parseData) {
    let candidate = new RTCIceCandidate({ candidate: parseData['call_message']['candidate']['candidate'], sdpMid:parseData['call_message']['candidate']['sdpMid'], sdpMLineIndex: parseData['call_message']['candidate']['sdpMLineIndex'], });
    targetUsername = parseData['peer'];
    var candidates = mapPeers[targetUsername][1];
    myPeerConnection = mapPeers[targetUsername][0];
    console.log("mypeerconnection:",myPeerConnection)
    if (!myPeerConnection && !myPeerConnection.remoteDescription)
        candidates.push(candidate);
    else
        myPeerConnection.addIceCandidate(candidate);
}


var messageList = document.querySelector('#all_messages');
var messageInput = document.querySelector('#chat_message');
document.querySelector('#chat_message').onkeyup = function(e) {
    if (e.keyCode === 13) { 
        document.querySelector('#sendMsg').click();
    }
};
var btnSendMsg = document.getElementById('sendMsg');
btnSendMsg.addEventListener('click',sendMsgOnClick);

function sendMsgOnClick(){
    var message = messageInput.value;
    webSocket.send(JSON.stringify({
        'message': message,
        'command':'new_message',
        'from': user_name,
        'team_id': team_id,
        'call_message': {},
    }))
    messageInput.value='';
}

function createMessage(data)
{
    var author = data['user'];
    var content = data.content;
    if(author == user_name)
    {
        messageList.innerHTML =
        messageList.innerHTML +
        `<div class="message">
            <b><span> You: </span></b>
            <span>${content}</span>
        </div>`;
    }
    else
    {
        messageList.innerHTML =
        messageList.innerHTML +
        `<div class="message">
            <b><span>${author}</span></b>
            <span>${content}</span>
        </div>`;
    }
}

function removeVideo(video)
{
    video.parentNode.removeChild(video);
}

function muteUnmute(){
    var enabled = localStream.getAudioTracks()[0].enabled;
    if (enabled) {
        localStream.getAudioTracks()[0].enabled = false;
        setUnmuteButton();
    }
    else {
        setMuteButton();
        localStream.getAudioTracks()[0].enabled = true;
    }
}

function leave_meet(){
    sendSignal('leave_meet',{
        'peer': '{{user.username}}'
    });
}

function handleLeaveMeet(parseData){
    myPeerConnection = mapPeers[parseData['peer']][0];
    targetUsername = mapPeers['peer']  
    delete mapPeers[targetUsername];
    myPeerConnection.close();
    removeVideo(remoteVideo);
    videoExisting = videoExisting.filter(i => i !== targetUsername);
        
}

function playPause(){
    var enabled = localStream.getVideoTracks()[0].enabled;
    if (enabled) {
        localStream.getVideoTracks()[0].enabled = false;
        setPauseVideo();
    }
    else {
        localStream.getVideoTracks()[0].enabled = true;
        setPlayVideo();
    }
}

function setUnmuteButton(){
    const html = `<i class="fas fa-microphone-slash"></i>`;
  document.getElementById("muteButton").innerHTML = html;
}

function setMuteButton(){
    const html = `<i class="fas fa-microphone"></i>`;
  document.getElementById("muteButton").innerHTML = html;

}

function setPauseVideo(){
  const html = `<i class="fas fa-video-slash"></i>`;
  document.getElementById("playPauseVideo").innerHTML = html;
}

function setPlayVideo(){
  const html = `<i class="fas fa-video"></i>`;
  document.getElementById("playPauseVideo").innerHTML = html;
}

