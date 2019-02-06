let debounce_hashupdate;
Vue.component('tractview', {
    props: [ "config" ],

    data () {
        return {
            load_percentage: 1,

            all_left: true,
            all_right: true,
            visible: true,

            meshes: [],

            dataMin: 0,
            dataMax: 0,
            gamma: 1,

            color_map: null,
            color_map_head: null,
            hist: [],
            focused: {},

            scene: null,
            renderer: null,
            camera: null,
            controls: null,

            camera_light: null,

            //tinyBrainScene: null,
            //tinyBrainCam: null,
            //brainRenderer: null,

            back_scene: null,

            niftis: [],
            selectedNifti: null,
        };
    },

    mounted() {
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        //this.brainRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

        this.scene = new THREE.Scene();
        this.back_scene = new THREE.Scene();

        // camera
        let viewbox = this.$refs.view.getBoundingClientRect();
        //let tinybrainbox = this.$refs.view_tinybrain.getBoundingClientRect();

        this.camera = new THREE.PerspectiveCamera(45, viewbox.width / viewbox.height, 1, 5000);
        //his.tinyBrainCam = new THREE.PerspectiveCamera(45, tinybrainbox.width / tinybrainbox.height, 1, 5000);

        this.camera.position.z = 200;
        window.addEventListener("resize", this.resized);

        /*
        // add tiny brain (to show the orientation of the brain while the user looks at fascicles)
        let objloader = new THREE.ObjectLoader();
        objloader.load('models/brain.json', _scene => {
            this.tinyBrainScene = _scene;
            let brainMesh = this.tinyBrainScene.children[1];
            unnecessaryDirectionalLight = this.tinyBrainScene.children[2];
            // align the tiny brain with the model displaying fascicles

            brainMesh.rotation.z += Math.PI / 2;
            brainMesh.material = new THREE.MeshLambertMaterial({ color: 0xffcc99 });

            this.tinyBrainScene.remove(unnecessaryDirectionalLight);

            let amblight = new THREE.AmbientLight(0x101010);
            this.tinyBrainScene.add(amblight);

            this.brainlight = new THREE.PointLight(0xffffff, 1);
            this.brainlight.radius = 20;
            this.brainlight.position.copy(this.tinyBrainCam.position);
            this.tinyBrainScene.add(this.brainlight);

            //let back_mesh = this.tinyBrainScene.children[1];
            //this.back_scene.add(amblight);
            //console.dir(brainMesh);
            var material = new THREE.LineBasicMaterial({
                color: new THREE.Color(255,255,255),
                //transparent: true,
                //opacity: 0.7,
                //vertexColors: THREE.VertexColors
            });
            let back_brainmesh = new THREE.LineSegments( brainMesh.geometry, material );
            //back_brainmesh.rotation.z += Math.PI / 2;
            //this.back_scene.add(back_brainmesh);
        });
        */

        // add subtle ambient lighting
        var ambientLight = new THREE.AmbientLight(0xc0c0c0);
        this.back_scene.add(ambientLight);

        //var meshMaterial = new THREE.MeshLambertMaterial({color: 0x7777ff, opacity: 0.5, transparent: true});
        /*
        var spotLight = new THREE.SpotLight(0xc0c0c0);
        spotLight.position.set(200, 400, 300);
        //spotLight.position.set(this.camera.position);
        this.back_scene.add(spotLight);
        */
        this.camera_light = new THREE.PointLight(0xffffff, 1);
        this.camera_light.radius = 20;
        //this.camera_light.position.copy(this.tinyBrainCam.position);
        this.back_scene.add(this.camera_light);

        let material = new THREE.MeshPhongMaterial({
            color: 0x102017,
            //transparent: true,
            side: THREE.DoubleSide,
            //opacity: 0.5,
            //colorWrite : false,
            //vertexColors: THREE.VertexColors,
            shininess: 10
        });
        //let material_cw = material.clone();
        //material_cw.colorWrite = true;

        let vtkloader = new THREE.VTKLoader();
        vtkloader.load('testdata/lh.10.vtk', geometry => {
            //geometry.center();
            geometry.computeFaceNormals(); //for flat shading
            geometry.computeVertexNormals(); //for smooth shading

            //let mesh  = THREE.SceneUtils.createMultiMaterialObject(geometry,[material,material_cw] )
            var mesh = new THREE.Mesh( geometry, material );
            //mesh.position.set( - 0.075, 0.005, 0 );
            mesh.rotation.x = -Math.PI/2;
            //mesh.scale.multiplyScalar( 0.2 );
            this.back_scene.add( mesh );

            //this.back_scene.add( new THREE.FaceNormalsHelper( mesh ) );
        });

        vtkloader.load('testdata/rh.10.vtk', geometry => {
            //geometry.center();
            geometry.computeVertexNormals();

            /*
            var material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(100,200,255),
                //transparent: true,
                //opacity: 0.7,
                //vertexColors: THREE.VertexColors
            });
            */

            var mesh = new THREE.Mesh( geometry, material );
            //mesh.position.set( - 0.075, 0.005, 0 );
            mesh.rotation.x = -Math.PI/2;
            //mesh.scale.multiplyScalar( 0.2 );
            this.back_scene.add( mesh );
        });
    
        /*
        // start loading the tract
        let idx = 0;
        async.eachLimit(this.config.tracts, 3, (tract, next_tract) => {
            this.load_tract(tract, idx++, (err, mesh) => {
                if (err) return next_tract(err);
                this.add_mesh_to_scene(mesh);
                this.load_percentage = idx / this.config.tracts.length;
                // this.config.num_fibers += res.coords.length;
                tract.mesh = mesh;
                next_tract();
            });
        }, console.log);
        */

        //load fibers
        //console.dir(this.config.rois);
        async.eachLimit(this.config.roi_pairs, 3, (pair, next_pair)=>{
            if(pair.filename == "") return next_pair();
            pair._url = "testdata/networkneuro/"+pair.filename;
            this.load_pair(pair, this.meshes.length, (err, mesh) => {
                if (err) return next_tract(err);
                
                //add mesh to the sence!
                mesh.rotation.x = -Math.PI/2;
                mesh.visible = false;
                this.meshes.push(mesh);
                this.scene.add(mesh);

                this.load_percentage = this.meshes.length / this.config.roi_pairs.length;
                Vue.set(pair, '_mesh', mesh); //probably I need to do this?

                next_pair();
            });          
        });

        this.renderer.autoClear = false;
        this.renderer.setSize(viewbox.width, viewbox.height);
        this.renderer.setClearColor(new THREE.Color(.1,.1,.1));
        this.$refs.view.appendChild(this.renderer.domElement);

        //this.brainRenderer.autoClear = false;
        //this.brainRenderer.setSize(tinybrainbox.width, tinybrainbox.height);
        //this.$refs.view_tinybrain.appendChild(this.brainRenderer.domElement);

        // use OrbitControls and make camera light follow camera position
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);

        /*
        this.handle_hash();
        window.parent.addEventListener("hashchange", e=>{
            this.handle_hash();
            this.render();
        });

        this.controls.addEventListener('change', e=>{
            let pan = this.controls.getPanOffset();

            //update URL hash
            clearTimeout(debounce_hashupdate);
            debounce_hashupdate = setTimeout(()=>{
                let pos_params = [ 
                    this.round(this.camera.position.x), 
                    this.round(this.camera.position.y), 
                    this.round(this.camera.position.z)
                ].join(";");
                let target_params = [ 
                    this.round(this.controls.target.x), 
                    this.round(this.controls.target.y), 
                    this.round(this.controls.target.z)
                ].join(";");
                let where = "where=" + pos_params + "/" + target_params;
                window.parent.location.hash = where;
            }, 100);
        });
        */
        this.controls.addEventListener('start', ()=>{
            this.controls.autoRotate = false;
        });

        this.render();
        if (this.config.layers) {
            this.config.layers.forEach(layer => {
                let condensed_filename = layer.url;
                if (condensed_filename.indexOf('/') != -1) condensed_filename = condensed_filename.substring(condensed_filename.lastIndexOf('/')+1);
                this.niftis.push({ user_uploaded: false, url: layer.url, user_uploaded: false, filename: condensed_filename });
            });
            this.selectedNifti = null;
        }
    },

    methods: {

        /*
        handle_hash() {
            let info_string = getHashValue('where');
            if (info_string) {
                let info = info_string.split('/');
                let pos = (info[0] || '').split(';');
                let orig = (info[1] || '').split(';');

                if (pos) {
                    this.camera.position.x = +pos[0];
                    this.camera.position.y = +pos[1];
                    this.camera.position.z = +pos[2];
                }
                if (orig) {
                    this.controls.target.x = +orig[0];
                    this.controls.target.y = +orig[1];
                    this.controls.target.z = +orig[2];

                    this.controls.setPubPanOffset(+orig[0], +orig[1], +orig[2]);
                }
            } else this.controls.autoRotate = true;
        },
        */

        render: function() {
            this.controls.enableKeys = !this.inputFocused();
            this.controls.update();

            this.camera_light.position.copy(this.camera.position);

            this.renderer.clear();
            this.renderer.clearDepth();
            this.renderer.render(this.back_scene, this.camera);
            this.renderer.render(this.scene, this.camera);

            /*
            // handle display of the tiny brain preview
            if (this.tinyBrainScene) {
                // normalize the main camera's position so that the tiny brain camera is always the same distance away from <0, 0, 0>
                let pan = this.controls.getPanOffset();
                let pos3 = new THREE.Vector3(
                    this.camera.position.x - pan.x,
                    this.camera.position.y - pan.y,
                    this.camera.position.z - pan.z
                ).normalize();
                this.tinyBrainCam.position.set(pos3.x * 10, pos3.y * 10, pos3.z * 10);
                this.tinyBrainCam.rotation.copy(this.camera.rotation);

                this.brainlight.position.copy(this.tinyBrainCam.position);

                this.brainRenderer.clear();
                this.brainRenderer.render(this.tinyBrainScene, this.tinyBrainCam);
            }
            */


            requestAnimationFrame(this.render);
        },

        /*
        round: function(v) {
            return Math.round(v * 1e3) / 1e3;
        },
        */

        /*
        tractFocus: function(LR, basename) {
            if (this.load_percentage == 1) {
                this.focused[basename] = true;

                if (LR.left) {
                    LR.left.material_previous = LR.left.material;
                    LR.left.material = white_material;
                }
                if (LR.right) {
                    LR.right.material_previous = LR.right.material;
                    LR.right.material = white_material;
                }
            }
        },

        tractUnfocus: function(LR, basename) {
            if (this.load_percentage == 1) {
                this.focused[basename] = false;

                if (LR.left && LR.left.material_previous) LR.left.material = LR.left.material_previous;
                if (LR.right && LR.right.material_previous) LR.right.material = LR.right.material_previous;
            }
        },
        */

        resized: function () {
            var viewbox = this.$refs.view.getBoundingClientRect();

            this.camera.aspect = viewbox.width / viewbox.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(viewbox.width, viewbox.height);
        },

        load_pair: function(pair, index, cb) {
            //console.log("loading", pair._url);
            fetch(pair._url).then(res=>{
                return res.json();
            }).then(json=>{
                var coords = json.coords;
                //convert each bundle to threads_pos array
                var threads_pos = [];
                //if(!coords) console.error("no coords for " ,pair._url);
                if(!Array.isArray(coords)) coords = [coords];
                coords.forEach(function(fascicle) {
                    //if (Array.isArray(fascicle[0])) fascicle = fascicle[0]; //for backward compatibility
                    var xs = fascicle.x;
                    var ys = fascicle.y;
                    var zs = fascicle.z;
                    for(var i = 1;i < xs.length;++i) {
                        threads_pos.push(xs[i-1]);
                        threads_pos.push(ys[i-1]);
                        threads_pos.push(zs[i-1]);
                        threads_pos.push(xs[i]);
                        threads_pos.push(ys[i]);
                        threads_pos.push(zs[i]);
                    }
                });

                //then convert that to bufferedgeometry
                var vertices = new Float32Array(threads_pos);
                var geometry = new THREE.BufferGeometry();
                geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3 ) );
                geometry.vertices = vertices;
                //geometry.tract_index = index;
                //geometry.tract = pair; //metadata..

                /*
                geometry.colors = [];
                for ( var i = 0; i < geometry.vertices.length; i+=2 ) {
                    geometry.colors[ i ] = new THREE.Color( Math.random(), Math.random(), Math.random() );
                    geometry.colors[ i + 1 ] = geometry.colors[ i ];
                }
                */

                var label = this.labels[pair.roi1.toString()];
                var material = new THREE.LineBasicMaterial({
                    color: new THREE.Color(label.color.r/256*2, label.color.g/256*2, label.color.b/256*2),
                    //transparent: true,
                    //opacity: 0.7,
                    //vertexColors: THREE.VertexColors
                    depthTest: false,
                });

                let mesh = new THREE.LineSegments( geometry, material );
                cb(null, mesh);
            });
        },

        /*
        calculateMesh: function(geometry, material) {

            if (this.color_map) {
                var vertexShader = `
                    attribute vec4 color;
                    varying vec4 vColor;

                    void main(){
                        vColor = color;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `;

                var fragmentShader = `
                    varying vec4 vColor;
                    uniform float dataMin;
                    uniform float dataMax;
                    uniform float gamma;

                    float transformify(float value) {
                        return pow(value / dataMax, 1.0 / gamma) * dataMax;
                    }

                    void main(){
                        gl_FragColor = vec4(transformify(vColor.r), transformify(vColor.g), transformify(vColor.b), vColor.a);
                    }
                `;

                var cols = [];
                var hist = [];
                for (var i = 0; i < geometry.vertices.length; i += 3) {
                    //convert webgl to voxel coordinates
                    var vx, vy, vz;
                    if (i == geometry.vertices.length - 3) {
                        vx = geometry.vertices[i];
                        vy = geometry.vertices[i+1];
                        vz = geometry.vertices[i+2];
                    } else {
                        vx = (geometry.vertices[i] + geometry.vertices[i+3])/2;
                        vy = (geometry.vertices[i+1] + geometry.vertices[i+4])/2;
                        vz = (geometry.vertices[i+2] + geometry.vertices[i+5])/2;
                    }

                    var x = Math.round((vx - this.color_map_head.spaceOrigin[0]) / this.color_map_head.thicknesses[0]);
                    var y = Math.round((vy - this.color_map_head.spaceOrigin[1]) / this.color_map_head.thicknesses[1]);
                    var z = Math.round((vz - this.color_map_head.spaceOrigin[2]) / this.color_map_head.thicknesses[2]);

                    //find voxel value
                    var v = this.color_map.get(z, y, x);
                    if (isNaN(v)) {
                        // if the color is invalid, then just gray out that part of the tract
                        cols.push(.5);
                        cols.push(.5);
                        cols.push(.5);
                        cols.push(1.0);
                    } else {
                        var normalized_v = (v - this.dataMin) / (this.dataMax - this.dataMin);
                        var overlay_v = (v - this.sdev_m5) / (this.sdev_5 - this.sdev_m5);

                        //clip..
                        // if(normalized_v < 0.1) normalized_v = 0.1;
                        // if(normalized_v > 1) normalized_v = 1;

                        if(overlay_v < 0.1) overlay_v = 0.1;
                        if(overlay_v > 1) overlay_v = 1;

                        //compute histogram
                        var hv = Math.round(normalized_v*256);
                        var glob_hv = Math.round(normalized_v * 100);
                        hist[hv] = (hist[hv] || 0) + 1;
                        this.hist[glob_hv] = (this.hist[glob_hv] || 0) + 1;

                        if (Array.isArray(geometry.tract.color)) {
                            cols.push(geometry.tract.color[0] * overlay_v);
                            cols.push(geometry.tract.color[1] * overlay_v);
                            cols.push(geometry.tract.color[2] * overlay_v);
                            cols.push(1.0);
                        }
                        else {
                            cols.push(geometry.tract.color.r * overlay_v);
                            cols.push(geometry.tract.color.g * overlay_v);
                            cols.push(geometry.tract.color.b * overlay_v);
                            cols.push(1.0);
                        }
                    }
                }
                geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 4));
                let material = new THREE.ShaderMaterial({
                    vertexShader,
                    fragmentShader,
                    uniforms: {
                        "gamma": { value: this.gamma },
                        "dataMin": { value: 1 },
                        "dataMax": { value: 1 },
                    },
                    transparent: true,
                });

                if (mesh) {
                    mesh.geometry = geometry;
                    mesh.material = material;
                    return mesh;
                } else {
                    var m = new THREE.LineSegments( geometry, material );

                    this.config.tracts[geometry.tract_index].mesh = m;
                    return m;
                }
            }
            var m = new THREE.LineSegments( geometry, material );
            //this.config.tracts[geometry.tract_index].mesh = m;
            return m;
        },
        */

        /*
        add_mesh_to_scene: function(mesh) {
            mesh.rotation.x = -Math.PI/2;
            this.meshes.push(mesh);
            this.scene.add(mesh);
        },
        */

        /*
        recalculateMaterials: function() {
            this.hist = [];
            this.meshes.forEach(mesh => {
                var material = new THREE.LineBasicMaterial({
                    color: new THREE.Color(geometry.tract.color.r, geometry.tract.color.g, geometry.tract.color.b),
                    transparent: true,
                    opacity: 0.7,
                });
                this.calculateMesh(mesh.geometry, material, mesh);
            });
        },
        */

        /*
        destroyPlot: function() {
            Plotly.purge(this.$refs.hist);
            this.$refs.hist.style.display = "none";
        },

        makePlot: function() {
            this.destroyPlot();

            var min_to_max = [];
            for (var x = 0; x <= 100; x++) {
                min_to_max.push(this.dataMin + (this.dataMax - this.dataMin) / 100 * x);
                this.hist[x] = this.hist[x] || 0;
            }

            this.$refs.hist.style.display = "inline-block";
            Plotly.plot(this.$refs.hist, [{
                x: min_to_max,
                y: this.hist,
            }], {
                xaxis: { gridcolor: '#444', tickfont: { color: '#aaa', size: 9 }, title: "Image Intensity" },
                yaxis: { gridcolor: '#444', tickfont: { color: '#aaa', size: 9 }, title: "Number of Voxels", titlefont: { size: 12 } },

                margin: {
                    t: 5,
                    b: 32,
                    l: 40,
                    r: 10
                },
                font: { color: '#ccc' },
                titlefont: { color: '#ccc' },

                plot_bgcolor: 'transparent',
                paper_bgcolor: 'transparent',
                autosize: true,

            }, { displayModeBar: false });
        },

        upload_file: function(e) {
            let file = e.target.files[0];
            let reader = new FileReader();
            reader.addEventListener('load', buffer=>{
                this.niftis.push({ user_uploaded: true, filename: file.name, buffer: reader.result });
                this.selectedNifti = this.niftis.length - 1;
                this.niftiSelectChanged();
            });
            reader.readAsArrayBuffer(file);
        },
        */
        /*
        niftiSelectChanged: function() {
            if (this.selectedNifti === null) {
                this.color_map = undefined;

                this.recalculateMaterials();
                this.destroyPlot();
                this.showAll();
            } else {
                let nifti = this.niftis[this.selectedNifti];
                if (nifti.user_uploaded) this.processDeflatedNiftiBuffer(nifti.buffer);
                else {
                    fetch(nifti.url)
                        .then(res => res.arrayBuffer())
                        .then(this.processDeflatedNiftiBuffer)
                        .catch(err => console.error);
                }
            }
        },
        */

        showAll: function() {
            this.meshes.forEach(m => m.visible = true);
        },

        /*
        processDeflatedNiftiBuffer: function(buffer) {
            var raw = pako.inflate(buffer);
            var N = nifti.parse(raw);

            this.color_map_head = nifti.parseHeader(raw);
            this.color_map = ndarray(N.data, N.sizes.slice().reverse());

            this.color_map.sum = 0;
            this.dataMin = null;
            this.dataMax = null;

            N.data.forEach(v=>{
                if (!isNaN(v)) {
                    if (this.dataMin == null) this.dataMin = v;
                    else this.dataMin = v < this.dataMin ? v : this.dataMin;
                    if (this.dataMax == null) this.dataMax = v;
                    else this.dataMax = v > this.dataMax ? v : this.dataMax;

                    this.color_map.sum+=v;
                }
            });
            this.color_map.mean = this.color_map.sum / N.data.length;

            //compute sdev
            this.color_map.dsum = 0;
            N.data.forEach(v=>{
                if (!isNaN(v)) {
                    var d = v - this.color_map.mean;
                    this.color_map.dsum += d*d;
                }
            });
            this.color_map.sdev = Math.sqrt(this.color_map.dsum/N.data.length);

            //set min/max
            this.sdev_m5 = this.color_map.mean - this.color_map.sdev*5;
            this.sdev_5 = this.color_map.mean + this.color_map.sdev*5;

            this.recalculateMaterials();
            this.makePlot();
            this.showAll();
        },
        */

        inputFocused: function() {
            let result = false;
            Object.keys(this.$refs).forEach(k => result = result || (document.activeElement == this.$refs[k]) );
            return result;
        },

        /*
        appendStyle: function() {
            this.$refs.style.innerHTML = `
            <style scoped>
            </style>`;
        }
        */
    },

    computed: {

        //create label look up object
        labels: function() {
            return this.config.labels.reduce((a,c)=>{
                a[c.label.toString()] = c;
                return a;
            }, {});
        },

        /*
        sortedMeshes: function() {
            let out = {};
            this.meshes.map(m=>m).sort((_a, _b) => {
                var a = _a.name; var b = _b.name;
                var a_has_lr = isLeftTract(a) || isRightTract(a);
                var b_has_lr = isLeftTract(b) || isRightTract(b);

                if (a_has_lr && !b_has_lr) return 1;
                if (!a_has_lr && b_has_lr) return -1;

                if (a > b) return 1;
                if (a == b) return 0;
                return -1;
            }).forEach(m => {
                if (m.previous_material && m.material == white_material) m.material = m.previous_material;

                if (isRightTract(m.name)) {
                    let basename = removeRightText(m.name);
                    out[basename] = out[basename] || {};
                    out[basename].right = m;
                } else {
                    let basename = removeLeftText(m.name);
                    out[basename] = out[basename] || {};
                    out[basename].left = m;
                }
            });

            return out;
        }
        */
    },

    watch: {
        /*
        all_left: function() {
            this.meshes.forEach(m => {
                if (!isRightTract(m.name)) m.visible = this.all_left;
            });
        },

        all_right: function() {
            this.meshes.forEach(m => {
                if (isRightTract(m.name)) m.visible = this.all_right;
            });
        },
        */
    },

    template: `
    <div class="container" style="display:inline-block;">
         <div ref="style" scoped></div>
         <div id="conview" class="conview" ref="view" style="position:absolute; width: 100%; height:100%;"></div>
         <!--<div id="tinybrain" class="tinybrain" style="width:100px;height:100px;" ref="view_tinybrain"></div>-->
         <div v-if="load_percentage < 1" id="loading" class="loading">Loading... ({{Math.round(load_percentage*100)}}%)</div>
         <a id="bllogo" class="bllogo" href="https://brainlife.io">brainlife</a>
         <amatrix :roi_pairs="config.roi_pairs" :labels="config.labels"/>
    </div>            
    `
})

let white_material = new THREE.LineBasicMaterial({
    color: new THREE.Color(1, 1, 1)
});

function getHashValue(key) {
    var matches = window.parent.location.hash.match(new RegExp(key+'=([^&]*)'));
    return matches ? decodeURIComponent(matches[1]) : null;
}

// returns whether or not the tractName is considered to be a left tract
function isLeftTract(tractName) {
    return tractName.startsWith('Left ') || tractName.endsWith(' L');
}

// remove the 'left' part of the tract text
function removeLeftText(tractName) {
    if (tractName.startsWith('Left ')) tractName = tractName.substring(5);
    if (tractName.endsWith(' L')) tractName = tractName.substring(0, tractName.length - 2);
    return tractName;
}

// returns whether or not the tractName is considered to be a right tract
function isRightTract(tractName) {
    return tractName.startsWith('Right ') || tractName.endsWith(' R');
}

// remove the 'right' part of the tract text
function removeRightText(tractName) {
    if (tractName.startsWith('Right ')) tractName = tractName.substring(6);
    if (tractName.endsWith(' R')) tractName = tractName.substring(0, tractName.length - 2);
    return tractName;
}

