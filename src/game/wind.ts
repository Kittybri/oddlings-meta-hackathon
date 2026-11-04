/** Shared rightward gusts keep leaves, grass and branches moving together. */
export function windGust(strength:number,seconds:number,offset=0):number{
 const w=Math.max(0,Math.min(1,strength));
 return w*(.7+.2*Math.sin(seconds*1.15+offset*.12)+.1*Math.sin(seconds*2.7+offset*.3));
}
