import sys; from render import *
ts=[float(x) for x in sys.argv[1:]]
ims=[frame(t).resize((360,640)) for t in ts]
c=Image.new("L",(360*len(ims),640));[c.paste(im,(i*360,0)) for i,im in enumerate(ims)];c.save("still.jpg")
