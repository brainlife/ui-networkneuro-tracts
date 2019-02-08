let last_mouseover;

Vue.component('nnview', {
    data () {
        return {
            renderer: null,

            scene: null, //where rois mesh and tracts goes
            back_scene: null, //to put the black silouette

            camera: null,
            camera_light: null,

            controls: null,

            roi1_pointer: null,
            roi2_pointer: null,

            hoverpair: null, //roi pair hovered on amatrix
            hovered_roi: null, //roi mesh hovered on nnview

            loading: false,

            roi_pairs: null, 
            labels: null,

            columns: [], //list of roi (1001, 1002, etc..) in the order we want to display them in

            raycaster: new THREE.Raycaster(),

            gui: new dat.GUI(),
            /*
            controls: {
                autoRotate: true,
            }
            */
           weight_field: 'density',
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

        this.load_labels();
        this.load_index();

        /*
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
        */

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

        this.init_gui();
    },

    methods: {

        init_gui() {
            
            var ui = this.gui.addFolder('UI');
            ui.add(this.controls, 'autoRotate');
            //f1.add(this, 'noiseStrength');
            ui.open();

            var matrix = this.gui.addFolder('Matrix');
            matrix.add(this, 'weight_field',  [ 'count', 'density' ]);
            matrix.open();
        },

        load_labels() {
            //load lables and mesh
            fetch("labels.json").then(res=>{
                return res.json();
            }).then(json=>{

                let vtkloader = new THREE.VTKLoader();

                this.labels = json.labels;
                async.eachSeries(this.labels, (label, next_label)=>{
                    let id = parseInt(label.label);
                    if(id < 1000 || id > 2035) return next_label(); //only load lables that we care..

                    let tokens = label.name.split("-");
                    let vtk = "testdata/decimate/ctx-"+tokens[0]+"h-"+tokens[1]+".vtk";
                    //console.log("loading mesh", vtk);

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
                        label._hover_material = new THREE.MeshPhongMaterial({
                            color: new THREE.Color(label.color.r/256*1.5, label.color.g/256*1.5, label.color.b/256*1.5),
                            shininess: 70,
                        });

                        //calculate mesh center (for pointers)
                        geometry.computeBoundingBox();
                        var center = new THREE.Vector3();
                        geometry.boundingBox.getCenter(center);
                        mesh.localToWorld( center );
                        label._position = center;

                        next_label();
                    }, progress=>{}, err=>{
                        console.error(err);
                        next_label();
                    })
                });
            });
        },

        load_index() {
        
            //load index.json
            fetch("testdata/networkneuro/index.json").then(res=>{
                return res.json();
            }).then(json=>{
                this.roi_pairs = json.roi_pairs;

                //find unique rois
                let columns = this.roi_pairs.reduce((a,c)=>{
                    let label = this.labels_o[c.roi1.toString()];
                    a.add(label.label);
                    label = this.labels_o[c.roi2.toString()];
                    a.add(label.label);
                    return a;
                }, new Set());
                this.columns = [...columns].sort();   

                /*
                //find min/max value
                let min = null;
                let max = null;
                this.roi_pairs.forEach(roi=>{
                    let v = roi.weights.count;
                    if(v < min || min === null) min = v;
                    if(v > max || max === null) max = v;

                    roi._selected = false;
                });
                console.log("min", min);
                console.log("max", max);
                */

                //load fibers
                let vtkloader = new THREE.VTKLoader();
                let tracts = new THREE.Object3D();
                this.scene.add(tracts);
                this.loading = true;
                console.time('loading_pairs');
                async.eachSeries(this.roi_pairs/*.slice(0, 100)*/, (pair, next_pair)=>{
                    //console.log(pair.filename);
                    if(pair.filename == "") return next_pair();
                    pair._url = "testdata/networkneuro/"+pair.filename;
                    this.loading = pair.filename;
                    this.load_pair(pair, (err, mesh) => {
                        if (err) return next_tract(err);
                        mesh.rotation.x = -Math.PI/2;
                        mesh.visible = false;
                        tracts.add(mesh);
                        pair._mesh = mesh;
                        this.$forceUpdate();
                        next_pair();
                    });          
                }, err=>{
                    this.loading = false;
                    console.timeEnd('loading_pairs');
                });
            });
        },

        render() {
            //animate
            this.controls.update();
            this.camera_light.position.copy(this.camera.position);

            this.update_rois();
            this.update_pointers();

            //render
            this.renderer.clear();
            this.renderer.render(this.back_scene, this.camera);
            this.renderer.clearDepth();
            this.renderer.render(this.scene, this.camera);

            requestAnimationFrame(this.render);
        },

        update_rois() {
            this.scene.children.forEach(mesh=>{
                if(mesh._roi) {
                    let label = this.labels_o[mesh._roi];
                    if(this.hovered_roi == mesh._roi) {
                        mesh.material = label._hover_material;
                        //mesh.material.opacity = 0.2;
                    } else {
                        mesh.material = label._material;
                        //mesh.material.transparent = false;
                        //mesh.material.opacity = 1;
                    }
                }
            });
        },

        update_pointers() {
            if(!this.hoverpair) {
                //this.roi1_pointer.visible = false;
                //this.roi2_pointer.visible = false;
                return;
            }

            var label = this.labels_o[this.hoverpair.roi1.toString()];
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

        load_pair(pair, cb) {
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

                var label = this.labels_o[pair.roi1.toString()];
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
        mouseover_pair(pair) {
            if(pair._mesh) pair._mesh.visible = true;
           
            this.hoverpair = pair;
            this.change_vis(pair.roi1, true);
            this.change_vis(pair.roi2, true);
        },
        */

        /*
        mouseleave_pair(pair) {
            if(pair._mesh && !pair._selected) pair._mesh.visible = false;

            this.hoverpair = null;
            let selected = this.selected_rois();
            this.change_vis(pair.roi1, selected.has(pair.roi1));
            this.change_vis(pair.roi2, selected.has(pair.roi2));
        },
        */

        change_vis(roi, vis) {
            let mesh = this.labels_o[roi]._mesh;
            if(mesh) mesh.visible = vis;
        },

        /*
        clickpair(pair) {
            let p = this.roi_pairs.indexOf(pair);
            this.roi_pairs[p]._selected = !pair._selected; 
            //Vue.set(pair, '_selected', !pair._selected);
            console.log("pair clicked", pair);
            console.log("hovered roi?", this.hoverpair);

            let selected = this.selected_rois();
            this.change_vis(pair.roi1, selected.has(pair.roi1)||this.hoverpair.roi1 == pair.roi1);
            this.change_vis(pair.roi2, selected.has(pair.roi2)||this.hoverpair.roi2 == pair.roi2);
            //console.log("_selected", pair._selected);
        },
        */

        getcolor(pair) {
            let h = 200;
            let s = 10;
            let l = 30;
            let a = 1;
            switch(this.weight_field) {
            case "count":
                a = Math.max(Math.log(pair.weights.count)/4, 0);
                break;
            case "density":
                a = pair.weights.density*200;
                //console.log(a);
                break;
            }

            if(pair._mesh) l = 90;
            if(pair._selected) {
                s = 100; //maybe I should use weights for this to show the original weight?
                l = 50;
                h = 0;
                a = 1.0;
            } else if(this.hoverpair && (pair.roi1 == this.hoverpair.roi1 && pair.roi2 == this.hoverpair.roi2)) {
                //cross hair!
                h = 30;
            } else if(this.hoverpair && (pair.roi1 == this.hoverpair.roi1 || pair.roi2 == this.hoverpair.roi2)) {
                
                //get roi color
                let label;
                if(pair.roi1 == this.hoverpair.roi1) label = this.labels_o[this.hoverpair.roi1];
                if(pair.roi2 == this.hoverpair.roi2) label = this.labels_o[this.hoverpair.roi2];
                let c = new THREE.Color("rgb("+label.color.r*2+","+label.color.g*2+","+label.color.b*2+")");

                //massage it a bit
                let hsl = {h, s, l};
                c.getHSL(hsl);
                h = hsl.h*360;
                l = hsl.l*100;
                s = 50;
                a = Math.max(a, 0.4);      
            }

            return "hsla("+h+", "+s+"%, "+l+"%, "+a+")";
        },

        getcolumncolor(column) {
            let label = this.labels_o[column];
            if(!label._mesh) return "gray"; 
            return "rgb("+label.color.r*2+","+label.color.g*2+","+label.color.b*2+")";
        },

        mouseover(pair) {
            this.hoverpair = pair;
            if(pair._mesh) pair._mesh.visible = true;
            this.change_vis(pair.roi1, true);
            this.change_vis(pair.roi2, true);
        },
        mouseleave(pair) {
            this.hoverpair = null;
            if(pair._mesh && !pair._selected) pair._mesh.visible = false;
            let selected = this.selected_rois();
            this.change_vis(pair.roi1, selected.has(pair.roi1));
            this.change_vis(pair.roi2, selected.has(pair.roi2));
        },

        mouseover_column(column) {
            let label = this.labels_o[column];
            this.hovered_roi = column
            if(label._mesh) label._mesh.visible = true;
        },

        mouseleave_column(column) {
            let label = this.labels_o[column];
            this.hovered_roi = null;
            if(label._mesh) {
                let selected = this.selected_rois();
                if(!selected.has(parseInt(label.label))) label._mesh.visible = false;
            }
        },     

        clickpair(pair) {
            let p = this.roi_pairs.indexOf(pair);
            this.roi_pairs[p]._selected = !pair._selected; 
            let selected = this.selected_rois();
            this.change_vis(pair.roi1, selected.has(pair.roi1)||this.hoverpair.roi1 == pair.roi1);
            this.change_vis(pair.roi2, selected.has(pair.roi2)||this.hoverpair.roi2 == pair.roi2);
            this.$forceUpdate();
        },

        find_roi_mesh(event) {
            var mouse = new THREE.Vector2();
            mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
            mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
            this.raycaster.setFromCamera( mouse, this.camera );
            let intersects = this.raycaster.intersectObjects(this.scene.children);
            for(let i = 0;i < intersects.length; ++i) {
                let obj = intersects[i].object;
                if(obj._roi) return obj;
            }
            return null;
        },

        mousemove(event) {
            let now = new Date().getTime();
            if(now - last_mouseover < 200) return; // too soon since last mousemove handling
            let obj = this.find_roi_mesh(event);
            this.hovered_roi = null;
            if(obj) this.hovered_roi = obj._roi;
            last_mouseover = now;
        },
        
        click(event) {
            let obj = this.find_roi_mesh(event);
            if(obj) {
                //TODO roi clicked.. what do I do?
            }
        },

        selected_rois: function() {
            let rois = new Set();
            this.roi_pairs.forEach(pair=>{
                if(!pair._selected) return;
                rois.add(pair.roi1);
                rois.add(pair.roi2);
            });
            return rois;
        },

        is_hovered: function(column) {
            return (this.hoverpair && (this.hoverpair.roi1 == column || this.hoverpair.roi2 == column) || this.hovered_roi == column)
        },
    },

    computed: {

        //labels lookup by column id
        labels_o: function() {
            return this.labels.reduce((a,c)=>{
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
         <div id="conview" class="conview" ref="view" style="position:absolute; width: 100%; height:100%;" @mousemove="mousemove" @click="click"></div>
         <div class="status">
             <span v-if="loading">Loading .. <small>{{loading}}</small></span>
             <small v-if="hoverpair">{{hoverpair.weights}}</small>
            <b>Brent McPherson</b> &middot; Network Neuro &middot; <b><a href="https://brainlife.io">brainlife.io</a></b>
         </div>
         <div class="amatrix" v-if="roi_pairs && labels">
            <svg> 
                <g transform="rotate(-90 315 305)">
                    <text v-for="(column, idx) in columns" :key="idx" 
                        :x="9*idx-2" :y="9*idx-2" text-anchor="start"
                        class="label" :class="{'label-selected':is_hovered(column)}"
                        :transform="'rotate(135 '+(9*idx)+' '+(9*idx)+')'" 
                        @mouseover="mouseover_column(column)"
                        @mouseleave="mouseleave_column(column)"
                        :fill="getcolumncolor(column)">{{labels_o[column].name}}</text>

                    <rect v-for="pair in roi_pairs" class="roi"
                        :x="columns.indexOf(pair.roi2.toString())*9" 
                        :y="columns.indexOf(pair.roi1.toString())*9" 
                        :fill="getcolor(pair)"
                        width="8" height="8" 
                        @mouseover="mouseover(pair)"
                        @mouseleave="mouseleave(pair)"
                        @click="clickpair(pair)"/>
                </g>
            </svg>
        </div>
        <!--
        <div class="controls" v-if="controls">
            <input type="checkbox" name="enableRotation" v-model="controls.autoRotate" /> Rotate
        </div>
        -->
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

