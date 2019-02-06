
#echo "generate brain vtk model (for visualization purpose)"
#mris_decimate -d 0.1 testdata/freesurfer/surf/lh.pial testdata/lh.10.pial
#mris_convert testdata/lh.10.pial testdata/lh.10.vtk
#
#mris_decimate -d 0.1 testdata/freesurfer/surf/rh.pial testdata/rh.10.pial
#mris_convert testdata/rh.10.pial testdata/rh.10.vtk

export PATH=$PATH:/home/hayashis/git/areal/bin
annot2dpv testdata/freesurfer/label/lh.aparc.annot testdata/lh.aparc.annot.dpv
