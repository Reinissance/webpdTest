let stream = null
        async function enumerateSources() {
                /* check for audioContext */
            if (navigator && navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({video:false, audio:true})
                    let devices = await navigator.mediaDevices.enumerateDevices()
                    const mics = devices.filter(device => {
                        return device.kind === 'audioinput'
                    })
                /* release stream */
                    const tracks = stream.getTracks()
                    if (tracks) {
                        for( let t = 0; t < tracks.length; t++ ) tracks[t].stop()
                    }
                    /* load webpd */
                    initApp().
                        then(() => {
                            startApp().
                                then(() => {
                            })
                        })
                    return (mics)
                } catch(error) {
                    /* user refused permission, or media busy, or some other problem */
                    console.error(error.name, error.message)
                    loadPrompt.style.display = 'none'
                    loadingDiv.style.display = 'none'
                    startButton.style.display = 'none'
                    audioHoverer.style.display = 'none'
                    return {mics:[]}
                }
            }
            else {
                /* browser has no mediaContext */
                loadPrompt.textContent = 'so sorry, but media device stuff not available in this browser'
                startButton.style.display = 'none'
                audioHoverer.style.display = 'none'
                closePrompt.style.display = 'block'
                closePrompt.addEventListener('click', function () {
                    loadPrompt.style.display = 'none'
                    loadingDiv.style.display = 'none'
                })
            }
        }

        const volumeSlider = document.querySelector('#volslider')
        const audioHoverer = document.querySelector('#audioOpts')
        const startPlay = document.querySelector('#playButton')
        const inputSliders = document.querySelectorAll('.isliders')
        const lastBar = document.querySelector('#lastBar')
        const barText = document.querySelector('#barText')

        const loadingDiv = document.querySelector('#loading')
        const loadPrompt = document.querySelector('#loadtext')
        const closePrompt = document.querySelector('#closeloader')
        const startButton = document.querySelector('#start')

        let patch = null
        let webpdNode = null
        let loaded = null, resumed = null;
        const audioContext = new AudioContext({sampleRate: 44100})
        const volGainNode = audioContext.createGain()
        

        const initApp = async () => {
            // Register the worklet
            await WebPdRuntime.registerWebPdWorkletNode(audioContext)

            // Fetch the patch code
            response = await fetch('js/remX.wasm')
            patch = await response.arrayBuffer()
        }

        const startApp = async () => {
                if (audioContext.state === 'suspended') {
                    audioContext.resume()
                }
                // Setup web audio graph
                const sourceNode = audioContext.createMediaStreamSource(stream)
                webpdNode = new WebPdRuntime.WebPdWorkletNode(audioContext)
                sourceNode.connect(webpdNode)
                webpdNode.connect(volGainNode)
                volGainNode.connect(audioContext.destination)
                volGainNode.gain.value = 0.2
                volumeSlider.value = 20

                // Setup filesystem management
                webpdNode.port.onmessage = (message) => WebPdRuntime.fsWeb(webpdNode, message)

                // Send code to the worklet                
                webpdNode.port.postMessage({
                    type: 'code:WASM',
                    payload: {
                        wasmBuffer: patch,
                    },
                })

                // iOS Safari needs this
                if (audioContext.state === 'suspended') {
                    audioContext.resume()
                }

                startButton.textContent = 'stop sound'

                /* hide the loadingPromt */
                loadPrompt.style.display = 'none'
                loadingDiv.style.display = 'none'
                loaded = true
                resumed = true
            }


        function startButtonClicked () {
            if (!loaded) {
                /* show the loadingPromt */
                loadPrompt.style.display = 'flex'
                loadingDiv.style.display = 'flex'
                /* check for audioContext */
                enumerateSources()
            }
            else {
                if (startButton.textContent === 'allow sound') {
                    audioContext.resume();
                    startButton.textContent = 'stop sound'
                    volumeSlider.style.display = 'flex'
                    resumed = true
                 }
                 else {
                    audioContext.suspend();
                    startButton.textContent = 'allow sound'
                    volumeSlider.style.display = 'none'
                    resumed = false
                 }
            }
        }

        /* interaction to pure data (send messages) */
        const sendMsgToWebPd = (nodeId, portletId, message) => {
            webpdNode.port.postMessage({
                type: 'inletCaller',
                payload: {
                    nodeId,
                    portletId,
                    message,
                },
            })
        }

        /* show or hide startbutton und volumeslider*/
        audioHoverer.addEventListener('mouseover', function () {
            if (loaded & resumed)
                volumeSlider.style.display = 'flex'
        })
        audioHoverer.addEventListener('mouseout', function () {
            if (loaded & resumed)
                volumeSlider.style.display = 'none'
        })

        /* set global volume with audioContext */
        volumeSlider.addEventListener('input', function () {
            volGainNode.gain.setValueAtTime(this.value/100, audioContext.currentTime)
        })

        /* add Function the inputSliders */
        inputSliders.forEach(input => {
            input.addEventListener('input', function() {
                if (loaded & resumed) {
                    /* this.value seems to be of undefined type, webpd needs Numbers*/
                    let svalue = Number(this.value)
                    sendMsgToWebPd(this.name, '0', [svalue])
                }
                else soundNotActive()
            })
        })

        /* functions for interaction with the pdPach*/
        function play() {
            if (loaded & resumed) {
                startPlay.textContent = (startPlay.name == 'Play') ? 'Stop' : 'Play';
                sendMsgToWebPd('n_0_1', '0', (startPlay.name == 'Play') ? [1] : [0])
                startPlay.name = (startPlay.name == 'Play') ? 'Stop' : 'Play';
            }
            else soundNotActive()
        }

        /* set Text on user action & send to pd*/

        let startText = "The Intro of Micle's Billy Jean has five bars, the "

        function loadFile(name) {
            if (loaded & resumed) {
                startText = (name == 'n_0_12') ? "The Intro of Micle's Billy Jean has five bars, the " : (name == 'n_0_11') ? "This file also has 5 bars, the " : "This file has only 4 bars, the "
                setBarText((name == 'n_0_12') ? 'second' : 'last one')
                sendMsgToWebPd(name, '0', ['bang'])
                    lastBar.style.display = (name == 'n_0_13') ?  'none' : 'block'
            }
            else soundNotActive()
        }

        function setBarText (bar) {
            barText.textContent = startText + bar + " is chosen to be the main bar."
        }

        function setBar(bar) {
            if (loaded & resumed) {
                sendMsgToWebPd(bar, '0', ['bang'])
                setBarText((bar == 'n_0_3') ? 'first' : (bar == 'n_0_4') ? 'second' : (bar == 'n_0_14') ? 'third' : (startText.split(' ').slice(0,3).join('+') != 'This+file+has' & bar == 'n_0_5') ? 'fourth' : 'last one')
            }
            else soundNotActive()
        }

        /* promt if sound not allowed */

        function soundNotActive() {
            var promt = confirm ("PLEASE ALLOW SOUND IN YOUR BROWSER FIRST...\n(click the button in the upper right corner of the page)");
            if (promt) {
                let start = Date.now();
                let timer = setInterval(function() {
                  let timePassed = Date.now() - start;
                  let m = (timePassed < 250) ? timePassed + 5 : (500 - timePassed) + 5
                //   audioHoverer.style.margin = m + 'px';
                  audioHoverer.style.padding = m + 'px';
                  if (timePassed > 500) {
                    clearInterval(timer);
                    audioHoverer.style.margin = 0
                  }
                }, 20);
            }
        }