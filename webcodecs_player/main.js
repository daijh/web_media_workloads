'use strict';

var ivf_reader;
var timer;
var is_pause = false;

function error_callback(e) {
  console.log(e);

  stop();
  startButton.disabled = true;
  pauseButton.disabled = true;
  stopButton.disabled = true;
}

const file_selector = document.querySelector('input#fileInput');
file_selector.addEventListener('click', (event) => {
  //console.log(event);

  stop();
  startButton.disabled = true;
  pauseButton.disabled = true;
  stopButton.disabled = true;
});
file_selector.addEventListener('change', (event) => {
  //console.log(event);

  const file_list = event.target.files;
  ivf_reader = new IVFReader({ file: file_list[0], callback: error_callback });
  startButton.disabled = false;
});

const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const stopButton = document.getElementById('stopButton');

var $ = document.getElementById.bind(document);
const nPlayersInput = $('numPlayers');
const frameRateInput = $('frameRate');
const render_all_streams = $('render_all_streams');

startButton.disabled = true;
pauseButton.disabled = true;
stopButton.disabled = true;

startButton.addEventListener('click', start);
pauseButton.addEventListener('click', pause);
stopButton.addEventListener('click', stop);

window.onload = function () {
}

async function DrawFrame(canvas, video_frame) {
  //console.log(video_frame);

  //canvas.width = video_frame.displayWidth;
  //canvas.height = video_frame.displayHeight;
  let context = canvas.getContext("2d");
  await createImageBitmap(video_frame)
    .then((imageBitmap) => {
      context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
      video_frame.close();
    });
}

function AddNewCanvas() {
  let canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  document.body.appendChild(canvas);
  return canvas;
}

function addNewVideoElement(media_stream) {
  var video = document.createElement('video');

  video.autoplay = true;
  video.muted = true;
  //video.controls = true;
  //video.playsinline = true;

  video.width = 320;
  video.height = 240;
  video.srcObject = media_stream;

  document.body.appendChild(video);
  return video;
}

function AddDecoder(codec, on_video_frame) {
  let video_decoder = new VideoDecoder({ output: on_video_frame, error: error_callback });
  video_decoder.configure({ codec: codec });
  //console.log(video_decoder);
  return video_decoder;
}

function Player(codec, is_render) {
  if (is_render) {
    this.trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    this.writer = this.trackGenerator.writable.getWriter();
    this.video = addNewVideoElement(new MediaStream([this.trackGenerator]));
  }

  this.OnVideoFrame = (frame) => {
    if (this.decoder.decodeQueueSize > 10) {
      console.log('decodeQueueSize', this.decoder.decodeQueueSize)
    }
    //document.getElementById("decodeQueueSize").innerHTML = 'decodeQueueSize:' + this.decoder.decodeQueueSize.toString();

    if (this.writer)
      this.writer.write(frame);
    frame.close();
  };

  /*
  this.canvas = AddNewCanvas();
  this.OnVideoFrame = (frame) => {
    DrawFrame(this.canvas, frame);
    frame.close();
  };
  */

  this.decoder = AddDecoder(codec, this.OnVideoFrame);

  this.OnEncodedFrame = (encoded_frame) => {
    this.decoder.decode(encoded_frame);
  };
}

function start() {
  //console.log("start");

  startButton.disabled = true;
  pauseButton.disabled = false;
  stopButton.disabled = false;

  try {
    const ivf_info = ivf_reader.GetInfo();
    let players = [];
    const n_players = nPlayersInput.value;
    const frame_rate = frameRateInput.value;
    const enable_render = render_all_streams.checked;

    for (let i = 0; i < n_players; ++i) {
      players.push(new Player(ivf_info.codec, (enable_render || i == 0) ? true : false));
    }

    timer = setInterval(async function () {
      if (is_pause)
        return;

      let ivf_frame = ivf_reader.ReadFrame();
      if (ivf_frame) {
        const encoded_video_trunk = new EncodedVideoChunk({ type: "key", timestamp: 0, data: ivf_frame.data });

        for (let player of players)
          player.OnEncodedFrame(encoded_video_trunk);
      }
    }, 1000.0 / frame_rate);
  } catch (e) {
    console.log(e);
    stop();
  }
}

function pause() {
  is_pause = !is_pause;

  //todo
  if (is_pause)
    pauseButton.textContent = 'Resume';
  else
    pauseButton.textContent = 'Pause';
}

function stop() {
  //console.log("stop");

  startButton.disabled = false;
  pauseButton.disabled = true;
  stopButton.disabled = true;

  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }

  if (ivf_reader) {
    ivf_reader.Reset();
  }

  is_pause = false;
}
