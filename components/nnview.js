let debounce_hashupdate;

Vue.component('nnview', {
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

            //niftis: [],
            //selectedNifti: null,
            roi1_pointer: null,
            roi2_pointer: null,

            hoverpair: null, //roi pair hovered on amatrix
            hovered_roi: null, //roi mesh hovered on nnview

            raycaster: new THREE.Raycaster(),
        };
    },

    mounted() {
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

        this.scene = new THREE.Scene();
        this.back_scene = new THREE.Scene();

        let viewbox = this.$refs.view.getBoundingClientRect();
        this.camera = new THREE.PerspectiveCamera(45, viewbox.width / viewbox.height, 1, 5000);
        this.camera.position.z = 200;
        
        var ambientLight = new THREE.AmbientLight(0x303030);
        this.scene.add(ambientLight);

        this.camera_light = new THREE.PointLight(0xffffff, 1);
        this.camera_light.radius = 10;
        this.scene.add(this.camera_light);

        /*
        let material = new THREE.MeshPhongMaterial({
            color: 0x102017,
            //transparent: true,
            //side: THREE.DoubleSide,
            //opacity: 0.5,
            //colorWrite : false,
            //vertexColors: THREE.VertexColors,
            //shininess: 30
        });
        */

        let vtkloader = new THREE.VTKLoader();
        /*
        vtkloader.load('testdata/lh.10.vtk', geometry => {
            //geometry.center();
            //geometry.computeFaceNormals(); //for flat shading
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
        */
    
        //load fibers
        let tracts = new THREE.Object3D();
        tracts.id = "tracts";
        this.scene.add(tracts);
        async.eachLimit(this.config.roi_pairs, 3, (pair, next_pair)=>{
            if(pair.filename == "") return next_pair();
            pair._url = "testdata/networkneuro/"+pair.filename;
            this.load_pair(pair, this.meshes.length, (err, mesh) => {
                if (err) return next_tract(err);
                mesh.rotation.x = -Math.PI/2;
                mesh.visible = false;
                this.meshes.push(mesh);
                tracts.add(mesh);
                this.load_percentage = this.meshes.length / this.config.roi_pairs.length;
                Vue.set(pair, '_mesh', mesh); //probably I need to do this?
                next_pair();
            });          
        });

        //load roi vtk
        async.eachLimit(this.labels, 1, (label, next_label)=>{
            let id = parseInt(label.label);
            if(id < 1000 || id > 2035) return next_label();

            let tokens = label.name.split("-");
            let vtk = "testdata/decimate/ctx-"+tokens[0]+"h-"+tokens[1]+".vtk";

            vtkloader.load(vtk, geometry => {
                let back_material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0,0,0),
                    depthTest: false,
                });
                var back_mesh = new THREE.Mesh( geometry, back_material );
                back_mesh.rotation.x = -Math.PI/2;
                this.back_scene.add(back_mesh);

                let roi_material = new THREE.MeshLambertMaterial({
                    color: new THREE.Color(label.color.r/256, label.color.g/256, label.color.b/256),

                });
                geometry.computeVertexNormals(); //for smooth shading
                var mesh = new THREE.Mesh( geometry, roi_material );
                mesh.rotation.x = -Math.PI/2;
                mesh.visible = false;
                mesh._roi = label.label;
                this.scene.add(mesh);
                label._mesh = mesh;
                label._material = roi_material;

                //calculate mesh center
                geometry.computeBoundingBox();
                var center = new THREE.Vector3();
                geometry.boundingBox.getCenter(center);
                mesh.localToWorld( center );
                label._position = center;

                next_label();
            }, progress=>{}, err=>{
                //console.error(err);
                next_label();
            })
        });

        //create pointers
        var geometry = new THREE.Geometry();
        var material = new THREE.LineBasicMaterial( { color : 0xff0000 } );

        this.roi1_pointer = new THREE.Line( geometry, material );
        this.roi1_pointer.rotation.x = -Math.PI/2;
        this.roi1_pointer.visible = false;
        this.scene.add(this.roi1_pointer);
        
        this.roi2_pointer = new THREE.Line( geometry, material );
        this.roi2_pointer.rotation.x = -Math.PI/2;
        this.roi2_pointer.visible = false;
        this.scene.add(this.roi2_pointer);

        this.renderer.autoClear = false;
        this.renderer.setSize(viewbox.width, viewbox.height);
        this.renderer.setClearColor(new THREE.Color(.1,.1,.1));
        this.$refs.view.appendChild(this.renderer.domElement);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.autoRotate = true;

        this.controls.addEventListener('start', ()=>{
            this.controls.autoRotate = false;
        });

        window.addEventListener("resize", this.resized);

        this.render();
        /*
        if (this.config.layers) {
            this.config.layers.forEach(layer => {
                let condensed_filename = layer.url;
                if (condensed_filename.indexOf('/') != -1) condensed_filename = condensed_filename.substring(condensed_filename.lastIndexOf('/')+1);
                this.niftis.push({ user_uploaded: false, url: layer.url, user_uploaded: false, filename: condensed_filename });
            });
            this.selectedNifti = null;
        }
        */
    },

    methods: {
        render() {
            //animate
            //this.controls.enableKeys = !this.inputFocused();
            this.controls.update();
            this.camera_light.position.copy(this.camera.position);

            this.update_pointers();

            //render
            this.renderer.clear();
            this.renderer.render(this.back_scene, this.camera);
            this.renderer.clearDepth();
            this.renderer.render(this.scene, this.camera);

            requestAnimationFrame(this.render);
        },

        update_pointers() {
            if(!this.hoverpair) {
                //this.roi1_pointer.visible = false;
                //this.roi2_pointer.visible = false;
                return;
            }

            var label = this.labels[this.hoverpair.roi1.toString()];
            if(label._mesh) {

                /*
                //create new geometry
                var pos1 = new THREE.Vector3( 0.3, 0, 0.5 );
                pos1.unproject(this.camrea);
                //pos1.applyAxisAngle( new THREE.Vector3( 1, 0, 0 ), Math.PI/2 );
                var pos2 = new THREE.Vector3( 0.2, 0.5, 0 );
                pos2.unproject(this.camera);
                //pos2.applyAxisAngle( new THREE.Vector3( 1, 0, 0 ), Math.PI/2 );
                var pos3 = new THREE.Vector3( 0, 0.25, 0 );
                pos3.unproject(this.camera)
                //pos3.applyAxisAngle( new THREE.Vector3( 1, 0, 0 ), Math.PI/2 );
                var curve = new THREE.CubicBezierCurve3(
                    label._position, pos3, pos2, pos1,
                );
                this.roi1_pointer.geometry.vertices = curve.getPoints(10);
                this.roi1_pointer.geometry.verticesNeedUpdate = true;
                    
                this.roi1_pointer.visible = true;
                //this.roi2_pointer.visible = true;
                */
            }
        },

        resized() {
            var viewbox = this.$refs.view.getBoundingClientRect();

            this.camera.aspect = viewbox.width / viewbox.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(viewbox.width, viewbox.height);
        },

        load_pair(pair, index, cb) {
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
                    color: new THREE.Color(label.color.r/256*3, label.color.g/256*3, label.color.b/256*3),
                    transparent: true,
                    opacity: 0.6,
                    //vertexColors: THREE.VertexColors
                    //depthTest: false,
                });

                let mesh = new THREE.LineSegments( geometry, material );
                cb(null, mesh);
            });
        },

        /*
        showAll() {
            this.meshes.forEach(m => m.visible = true);
        },

        inputFocused: function() {
            let result = false;
            Object.keys(this.$refs).forEach(k => result = result || (document.activeElement == this.$refs[k]) );
            return result;
        },
        */
        update_hoverpair(pair) {
            this.hoverpair = pair;
        },

        mousemove(event) {
            var mouse = new THREE.Vector2();
            mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
            mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
            this.raycaster.setFromCamera( mouse, this.camera );
            var intersects = this.raycaster.intersectObjects( this.scene.children );
            //find the first non-tracts mesh

            this.hovered_roi = null;
            //find the first roi
            for(let i = 0;i < intersects.length; ++i) {
                //console.log(intersects[i].object._type);
                if(intersects[i].object._roi) {
                    this.hovered_roi = intersects[i].object._roi;
                    break;
                }
            }
        }
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
         <div id="conview" class="conview" ref="view" style="position:absolute; width: 100%; height:100%;" @mousemove="mousemove"></div>
         <div v-if="load_percentage < 1" id="loading" class="status">
            <span v-if="load_percentage < 1">Loading .. {{Math.round(load_percentage*100)}}%</span>
            <span v-else>Network Neuro <b>&middot; Brent McPherson</b></span>
            <small v-if="hoverpair">{{hoverpair.weights}}</small>
         </div>
         <a id="bllogo" class="bllogo" href="https://brainlife.io">brainlife</a>
         <amatrix :roi_pairs="config.roi_pairs" :labels="config.labels" :hovered_roi="hovered_roi" @hover="update_hoverpair" @leave="hoverpair = null"/>
         <div class="controls" v-if="controls">
            <input type="checkbox" name="enableRotation" v-model="controls.autoRotate" /> Rotate
         </div>
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

