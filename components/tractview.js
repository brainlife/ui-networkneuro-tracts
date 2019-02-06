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
            back_scene: null,

            niftis: [],
            selectedNifti: null,
        };
    },

    mounted() {
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

        this.scene = new THREE.Scene();
        this.back_scene = new THREE.Scene();

        let viewbox = this.$refs.view.getBoundingClientRect();
        this.camera = new THREE.PerspectiveCamera(45, viewbox.width / viewbox.height, 1, 5000);
        this.camera.position.z = 200;
        
        var ambientLight = new THREE.AmbientLight(0xc0c0c0);
        this.back_scene.add(ambientLight);

        this.camera_light = new THREE.PointLight(0xffffff, 1);
        this.camera_light.radius = 20;
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

        let vtkloader = new THREE.VTKLoader();
        vtkloader.load('testdata/lh.10.vtk', geometry => {
            //geometry.center();
            geometry.computeFaceNormals(); //for flat shading
            geometry.computeVertexNormals(); //for smooth shading

            //let mesh  = THREE.SceneUtils.createMultiMaterialObject(geometry,[material,material_cw] )
            var mesh = new THREE.Mesh( geometry, material );
            mesh.rotation.x = -Math.PI/2;
            this.back_scene.add( mesh );
        });
        vtkloader.load('testdata/rh.10.vtk', geometry => {
            geometry.computeVertexNormals();
            var mesh = new THREE.Mesh( geometry, material );
            mesh.rotation.x = -Math.PI/2;
            this.back_scene.add( mesh );
        });
    
        //load fibers
        async.eachLimit(this.config.roi_pairs, 3, (pair, next_pair)=>{
            if(pair.filename == "") return next_pair();
            pair._url = "testdata/networkneuro/"+pair.filename;
            this.load_pair(pair, this.meshes.length, (err, mesh) => {
                if (err) return next_tract(err);
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
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);

        this.controls.addEventListener('start', ()=>{
            this.controls.autoRotate = false;
        });
        window.addEventListener("resize", this.resized);

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
        render: function() {
            this.controls.enableKeys = !this.inputFocused();
            this.controls.update();
            this.camera_light.position.copy(this.camera.position);
            this.renderer.clear();
            this.renderer.render(this.back_scene, this.camera);
            this.renderer.clearDepth();
            this.renderer.render(this.scene, this.camera);

            requestAnimationFrame(this.render);
        },

        resized: function () {
            var viewbox = this.$refs.view.getBoundingClientRect();

            this.camera.aspect = viewbox.width / viewbox.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(viewbox.width, viewbox.height);
        },

        load_pair: function(pair, index, cb) {
            fetch(pair._url).then(res=>{
                return res.json();
            }).then(json=>{
                var coords = json.coords;
                //convert each bundle to threads_pos array
                var threads_pos = [];
                if(!Array.isArray(coords)) coords = [coords];
                coords.forEach(function(fascicle) {
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

                var label = this.labels[pair.roi1.toString()];
                var material = new THREE.LineBasicMaterial({
                    color: new THREE.Color(label.color.r/256*2, label.color.g/256*2, label.color.b/256*2),
                    transparent: true,
                    opacity: 0.7,
                    //vertexColors: THREE.VertexColors
                    //depthTest: false,
                });

                let mesh = new THREE.LineSegments( geometry, material );
                cb(null, mesh);
            });
        },

        showAll: function() {
            this.meshes.forEach(m => m.visible = true);
        },

        inputFocused: function() {
            let result = false;
            Object.keys(this.$refs).forEach(k => result = result || (document.activeElement == this.$refs[k]) );
            return result;
        },
    },

    computed: {

        //create label look up object
        labels: function() {
            return this.config.labels.reduce((a,c)=>{
                a[c.label.toString()] = c;
                return a;
            }, {});
        },

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

