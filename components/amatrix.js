Vue.component('amatrix',  {
    props: ["roi_pairs", "labels", "hovered_roi"],
    data() {
        return {
            columns: [], //list of roi (1001, 1002, etc..) in the order we want to display them in
            labels: {}, //to lookup label name from roi id

            hovered_roi1: null,
            hovered_roi2: null,
        }
    },

    template: `
        <div class="amatrix">
            <svg> 
                <g transform="rotate(90 0 0)">
                    <text v-for="(column, idx) in columns" :x="9*idx+610" :y="9*idx-400" text-anchor="end"
                        class="label" :class="{'label-selected':hovered_roi1 == column || hovered_roi2 == column || hovered_roi == column}" 
                        :transform="'rotate(-45 '+(9*idx+7)+' '+(9*idx+98)+')'" :fill="getroicolor(column)">{{labels_o[column].name}}</text>
                    <!--
                    <text v-for="(column, idx) in columns" :x="columns.length*9+3" :y="9*idx+107" 
                        class="label" :class="{'label-selected':hovered_roi1 == column}" 
                        :fill="getroicolor(column)">{{labels_o[column].name}}</text>
                    -->
                    <rect v-for="pair in roi_pairs" class="roi"
                        :x="columns.indexOf(pair.roi2.toString())*9+80" 
                        :y="columns.indexOf(pair.roi1.toString())*9-690" 
                        width="8" height="8" 
                        :fill="getcolor(pair)"
                        @mouseover="mouseover(pair)"
                        @mouseleave="mouseleave(pair)"
                        @click="click(pair)"
                        />
                </g>
            </svg>
        </div>
    `,
    
    computed: {

        //create label look up object
        labels_o: function() {
            return this.labels.reduce((a,c)=>{
                a[c.label.toString()] = c;
                return a;
            }, {});
        },

        selected_rois: function(roi) {
            let rois = new Set();
            this.roi_pairs.forEach(pair=>{
                if(!pair._selected) return;
                rois.add(pair.roi1);
                rois.add(pair.roi2);
            });
            //console.log("selected_rois");
            //console.log(rois);
            return rois;
        }
    },

    mounted() {

        //find unique rois
        let columns = this.roi_pairs.reduce((a,c)=>{
            let label = this.labels_o[c.roi1.toString()];
            a.add(label.label);
            label = this.labels_o[c.roi2.toString()];
            a.add(label.label);
            return a;
        }, new Set());
        this.columns = [...columns].sort();   
        //console.log(this.columns);

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
    },

    methods: {
        getcolor(pair) {
            let h = 0;
            let s = 0;
            let l = 30;
            let a = Math.max(Math.log(pair.weights.count)/4, 0);

            /*
            let l = Math.log(pair.weights.count)*10;
            let a = 0.2;
            if(pair._mesh) a = 0.7;          
            if(pair._mesh && pair._mesh.visible) a = 1.0;
            */
            if(pair._mesh) l = 90;
            //if(pair._mesh && pair._mesh.visible) l = 100;

            if(pair._selected) {
                //h=0;
                //l = Math.max(l, 40);
                //a = Math.max(l, 0.4);
                s = 100; //maybe I should use weights for this to show the original weight?
                l = 50;
                a = 1.0;
            } else if(pair.roi1 == this.hovered_roi1 && pair.roi2 == this.hovered_roi2) {
                h = 30;
                s = 100;
                l = 50;
                a = 1;
                //a = Math.max(a, 0.5);   
            } else if(pair.roi1 == this.hovered_roi1 || pair.roi2 == this.hovered_roi2) {
                
                //get roi color
                let label;
                if(pair.roi1 == this.hovered_roi1) label = this.labels_o[this.hovered_roi1];
                if(pair.roi2 == this.hovered_roi2) label = this.labels_o[this.hovered_roi2];
                let c = new THREE.Color("rgb("+label.color.r*2+","+label.color.g*2+","+label.color.b*2+")");

                //massage it a bit
                let hsl = {h, s, l};
                c.getHSL(hsl);
                h = hsl.h*360;
                l = hsl.l*100;
                s = 50;
                a = Math.max(a, 0.3);      
            }

            /*
            s = Math.max(s, 0);
            l = Math.max(l, 0);
            a = Math.max(a, 0);
            */
            
            return "hsla("+h+", "+s+"%, "+l+"%, "+a+")";
        },

        getroicolor(column) {
            let label = this.labels_o[column];
            return "rgb("+label.color.r*2+","+label.color.g*2+","+label.color.b*2+")";
        },
        mouseover(pair) {
            if(pair._mesh) pair._mesh.visible = true;
            this.hovered_roi1 = pair.roi1;
            this.hovered_roi2 = pair.roi2;
            this.change_vis(pair.roi1, true);
            this.change_vis(pair.roi2, true);

            this.$emit("hover", pair);
        },

        mouseleave(pair) {
            if(pair._mesh && !pair._selected) pair._mesh.visible = false;
            this.hovered_roi1 = null;
            this.hovered_roi2 = null;
            this.change_vis(pair.roi1, this.selected_rois.has(pair.roi1));
            this.change_vis(pair.roi2, this.selected_rois.has(pair.roi2));

            this.$emit("leave");
        },

        change_vis(roi, vis) {
            let mesh = this.labels_o[roi]._mesh;
            if(mesh) mesh.visible = vis;
        },
        
        click(pair) {
            pair._selected = !pair._selected;
            this.change_vis(pair.roi1, this.selected_rois.has(pair.roi1)||this.hovered_roi1 == pair.roi1);
            this.change_vis(pair.roi2, this.selected_rois.has(pair.roi2)||this.hovered_roi2 == pair.roi2);
        },
    }
})
