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
                    if (mics.length >= 1) console.log ('mics avail')
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
        const upperSec = document.querySelector('#firstSec')
        const lowerSec = document.querySelector('#secondSec')

        const loadingDiv = document.querySelector('#loading')
        const loadPrompt = document.querySelector('#loadtext')
        const closePrompt = document.querySelector('#closeloader')
        const startButton = document.querySelector('#start')

        let patch = null
        let webpdNode = null
        let loaded = null, resumed = null;
        const audioContext = new AudioContext()    
        const volGainNode = audioContext.createGain()
        

        const initApp = async () => {
            // Register the worklet
            await WebPdRuntime.registerWebPdWorkletNode(audioContext)

            // Fetch the patch code
            response = await fetch('js/effects.wasm')
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
                webpdNode.port.onmessage = (message) => WebPdRuntime.fs.web(webpdNode, message)

                // Send code to the worklet                
                webpdNode.port.postMessage({
                    type: 'code:WASM',
                    payload: {
                        wasmBuffer: patch,
                    },
                })

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
                    resumed = true
                 }
                 else {
                    audioContext.suspend();
                    startButton.textContent = 'allow sound'
                    resumed = false
                 }
            }
        }

        /* interactio to pure data */
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
            if (loaded)
                volumeSlider.style.display = 'flex'
        })
        audioHoverer.addEventListener('mouseout', function () {
            if (loaded)
                volumeSlider.style.display = 'none'
        })

        /* set global volume with audioContext */
        volumeSlider.addEventListener('input', function () {
            volGainNode.gain.setValueAtTime(this.value/100, audioContext.currentTime)
        })

        let mouseReceiver = null;
        /* soundeffects on hovering the sections */
        function sendFloatToNode (nodeId, value) {
            if (loaded && resumed) {
                sendMsgToWebPd(nodeId, '0', value)
                mouseReceiver = (value[0] == 0) ? null : nodeId;
            }
        }
        upperSec.addEventListener('mouseover', function() {sendFloatToNode('n_0_4', [1])})
        lowerSec.addEventListener('mouseover', function() {sendFloatToNode('n_0_3', [1])})
        upperSec.addEventListener('mouseout', function() {sendFloatToNode('n_0_4', [0])})
        lowerSec.addEventListener('mouseout', function() {sendFloatToNode('n_0_3', [0])})
        /* sendmouseEvent on mouseMove */
        document.addEventListener('mousemove', function(e) {
            /* only when over upper or lower section */
            if ((mouseReceiver !== null) && loaded && resumed) {
                    let bounds = (mouseReceiver == 'n_0_4') ? upperSec.getBoundingClientRect() : lowerSec.getBoundingClientRect();
                    let x = e.clientX - bounds.left;
                    let y = e.clientY - bounds.top;
                    console.log('upper:', x/(bounds.right-bounds.left), 1-y/bounds.bottom);
                    sendFloatToNode('n_0_5', [x/(bounds.right-bounds.left)])
                    sendFloatToNode('n_0_6', [1-y/(bounds.bottom)])
            }
        })