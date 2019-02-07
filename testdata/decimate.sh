for file in $(ls surfaces);
do
    echo $file
    mris_decimate -d 0.3 surfaces/$file decimate/$file
done
