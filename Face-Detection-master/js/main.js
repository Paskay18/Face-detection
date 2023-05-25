const video = document.getElementById("video");
let predictedAges = [];
let mediaRecorder;

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("./models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("./models"),
  faceapi.nets.faceExpressionNet.loadFromUri("./models"),
  faceapi.nets.ageGenderNet.loadFromUri("./models")
]).then(startVideo);

function startVideo() {
  navigator.getUserMedia(
    { video: true },
    stream => {
      video.srcObject = stream;
      startWebcam(stream);
    },
    err => console.error(err)
  );
}

video.addEventListener("playing", () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);

  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender();
    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

    const age = resizedDetections[0].age;
    const interpolatedAge = interpolateAgePredictions(age);
    const bottomRight = {
      x: resizedDetections[0].detection.box.bottomRight.x - 50,
      y: resizedDetections[0].detection.box.bottomRight.y
    };

    new faceapi.draw.DrawTextField(
      [`${faceapi.utils.round(interpolatedAge, 0)} years`],
      bottomRight
    ).draw(canvas);
  }, 100);
});

function interpolateAgePredictions(age) {
  predictedAges = [age].concat(predictedAges).slice(0, 30);
  const avgPredictedAge =
    predictedAges.reduce((total, a) => total + a) / predictedAges.length;
  return avgPredictedAge;
}

// Allowing button to stop or record
const videoButton = document.getElementById('main__video-button');

videoButton.onclick = () => {
  switch (videoButton.textContent) {
    case 'Record':
      videoButton.textContent = 'Stop';
      startRecording();
      break;
    case 'Stop':
      videoButton.textContent = 'Record';
      mediaRecorder.stop();
      break;
  }
};

async function init() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });
    startWebcam(stream);
  } catch (err) {
    console.log('Error retrieving a media device.');
    console.log(err);
  }
}

function startWebcam(stream) {
  window.stream = stream;
  video.srcObject = stream;
}

// To allow video output
function startRecording() {
  if (video.srcObject === null) {
    video.srcObject = window.stream;
  }
  mediaRecorder = new MediaRecorder(window.stream, { mimeType: 'video/webm;codecs=vp9,opus' });
  mediaRecorder.start();
  mediaRecorder.ondataavailable = recordVideo;
}

function recordVideo(event) {
  if (event.data && event.data.size > 0) {
    mediaRecorder.stop();

    const formData = new FormData();
    formData.append('video', event.data);

    fetch('/save-video', {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (response.ok) {
        console.log('Video saved successfully.');
      } else {
        console.error('Failed to save video.');
      }
    })
    .catch(error => {
      console.error('Error while saving video:', error);
    });
  }
}

