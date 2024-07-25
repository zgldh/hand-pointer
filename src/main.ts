
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl'
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection'
import '@mediapipe/hands'
import * as fp from 'fingerpose'

const config = {
  video: { width: 640, height: 480, fps: 30 }
}

type LandmarkColorsEnum = "thumb" | "index" | "middle" | "ring" | "pinky" | "wrist"
type HandednessEnum = "right" | "left";

const landmarkColors = {
  thumb: 'red',
  index: 'blue',
  middle: 'yellow',
  ring: 'green',
  pinky: 'pink',
  wrist: 'white'
}

const gestureIndexPointer = new fp.GestureDescription("index_pointer");
gestureIndexPointer.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl);
gestureIndexPointer.addCurl(fp.Finger.Middle, fp.FingerCurl.FullCurl);
gestureIndexPointer.addCurl(fp.Finger.Ring, fp.FingerCurl.FullCurl);
gestureIndexPointer.addCurl(fp.Finger.Pinky, fp.FingerCurl.FullCurl);

const gestureIndexClick = new fp.GestureDescription("index_click");
gestureIndexClick.addCurl(fp.Finger.Index, fp.FingerCurl.FullCurl, 1);
gestureIndexClick.addCurl(fp.Finger.Index, fp.FingerCurl.HalfCurl, 0.9);
gestureIndexClick.addCurl(fp.Finger.Middle, fp.FingerCurl.FullCurl);
gestureIndexClick.addCurl(fp.Finger.Ring, fp.FingerCurl.FullCurl);
gestureIndexClick.addCurl(fp.Finger.Pinky, fp.FingerCurl.FullCurl);

const knownGestures = [
  gestureIndexPointer,
  gestureIndexClick,
]
async function createDetector() {
  return handPoseDetection.createDetector(
    handPoseDetection.SupportedModels.MediaPipeHands,
    {
      runtime: "mediapipe",
      modelType: "full",
      maxHands: 2,
      solutionPath: `hands`,
    }
  )
}

async function main() {

  const video: HTMLVideoElement | null = document.querySelector("#pose-video")
  if (!video) {
    alert("Can not find video element");
    return;
  }
  const canvas: HTMLCanvasElement | null = document.querySelector("#pose-canvas")
  if (!canvas) {
    alert("Can not find canvas element");
    return;
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    alert("Can not get canvas 2D context");
    return;
  }

  const resultLayer: {
    right: HTMLElement,
    left: HTMLElement
  } = {
    right: document.querySelector("#pose-result-right") as HTMLElement,
    left: document.querySelector("#pose-result-left") as HTMLElement
  }
  // configure gesture estimator
  // add "✌🏻" and "👍" as sample gestures
  const GE = new fp.GestureEstimator(knownGestures)
  // load handpose model
  const detector = await createDetector()
  console.log("mediaPose model loaded")

  // main estimation loop
  const estimateHands = async () => {

    // clear canvas overlay
    ctx.clearRect(0, 0, config.video.width, config.video.height)
    resultLayer.right.innerText = ''
    resultLayer.left.innerText = ''

    // get hand landmarks from video
    const hands = await detector.estimateHands(video, {
      flipHorizontal: true
    })

    for (const hand of hands) {
      for (const keypoint of hand.keypoints) {
        const name: LandmarkColorsEnum = keypoint.name?.split('_')[0].toString().toLowerCase() as LandmarkColorsEnum;
        const color = landmarkColors[name] ?? 'white';
        drawPoint(ctx, keypoint.x, keypoint.y, 3, color)
      }

      // @ts-ignore
      const est = GE.estimate((hand.keypoints3D || []).map(item => ({
        0: item.x,
        1: item.y,
        2: (item.z === undefined ? 0 : item.z)
      })), 9)
      if (est.gestures.length > 0) {

        // find gesture with highest match score
        let result = est.gestures.reduce((p, c) => {
          return (p.score > c.score) ? p : c
        })
        const chosenHand: HandednessEnum = hand.handedness.toLowerCase() as HandednessEnum;
        resultLayer[chosenHand].innerText = result.name
        updateDebugInfo(est.poseData, chosenHand)
      }

    }
    // ...and so on
    setTimeout(() => { estimateHands() }, 1000 / config.video.fps)
  }

  estimateHands()
  console.log("Starting predictions")
}

async function initCamera(width: number, height: number, fps: number) {

  const constraints = {
    audio: false,
    video: {
      facingMode: "user",
      width: width,
      height: height,
      frameRate: { max: fps }
    }
  }

  const video: HTMLVideoElement | null = document.querySelector("#pose-video")
  if (!video) {
    alert("Can not find video element")
    return
  }

  video.width = width
  video.height = height

  // get video stream
  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  video.srcObject = stream

  return new Promise<HTMLVideoElement>(resolve => {
    video.onloadedmetadata = () => { resolve(video) }
  })
}

function drawPoint(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string | CanvasGradient | CanvasPattern) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 2 * Math.PI)
  ctx.fillStyle = color
  ctx.fill()
}

function updateDebugInfo(data: fp.GestureDescription[], hand: HandednessEnum) {
  const summaryTable = `#summary-${hand}`
  for (let fingerIdx in data) {
    const curl = document.querySelector(`${summaryTable} span#curl-${fingerIdx}`);
    if (curl) {
      // @ts-ignore
      curl.innerHTML = data[fingerIdx][1];
    }
    const dir = document.querySelector(`${summaryTable} span#dir-${fingerIdx}`);
    if (dir) {
      // @ts-ignore
      dir.innerHTML = data[fingerIdx][2];
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {

  initCamera(
    config.video.width, config.video.height, config.video.fps
  ).then(video => {
    if (video) {
      video.play()
      video.addEventListener("loadeddata", event => {
        console.log("Camera is ready")
        main()
      })
    }
  })

  const canvas: HTMLCanvasElement | null = document.querySelector("#pose-canvas")
  if (canvas) {
    canvas.width = config.video.width
    canvas.height = config.video.height
    console.log("Canvas initialized")
  }
});