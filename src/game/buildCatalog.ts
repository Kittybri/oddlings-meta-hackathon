/** Original Oddlings props, measured against a 7.5-tile tree/cottage. */
export const BUILD_ITEMS = [
  // Trees in the World scenery's style, sized against a creature (about 3 tiles tall) and the 7.5-tile cottage
  {type:'cherrytree',label:'Cherry Blossom',icon:'🌸',tiles:[9,6.6],top:0},
  {type:'autumntree',label:'Autumn Oak',icon:'🍁',tiles:[10,7.4],top:0},
  {type:'youngtree',label:'Young Tree',icon:'🌳',tiles:[6,4.1],top:0},
  {type:'sapling',label:'Sapling',icon:'🌱',tiles:[2.4,2.4],top:0},
  {type:'wooddoor',label:'Oak Door',icon:'🚪',tiles:[2.2,4.5],top:0},
  {type:'chest',label:'Treasure Chest',icon:'🧰',tiles:[3,1.9],top:12},
  {type:'barrel',label:'Storage Barrel',icon:'🛢️',tiles:[2,2.8],top:0},
  {type:'workbench',label:'Crafting Table',icon:'🔨',tiles:[3.5,2.2],top:12},
  {type:'bookshelf',label:'Bookshelf',icon:'📚',tiles:[3,4.5],top:0},
  {type:'bed',label:'Cozy Bed',icon:'🛏️',tiles:[4.5,1.8],top:18},
  {type:'picnictable',label:'Picnic Table',icon:'🧺',tiles:[5,2.7],top:14},
  {type:'gate',label:'Garden Gate',icon:'🚧',tiles:[3.5,2.5],top:8},
  {type:'ladder',label:'Wooden Ladder',icon:'🪜',tiles:[1.5,6],top:0},
  {type:'haybale',label:'Hay Bale',icon:'🌾',tiles:[3,2],top:10},
  {type:'wheatpatch',label:'Wheat Patch',icon:'🌾',tiles:[3,2.5],top:5},
  {type:'carrotpatch',label:'Carrot Patch',icon:'🥕',tiles:[3,1.5],top:16},
  {type:'bamboo',label:'Bamboo',icon:'🎋',tiles:[2,6],top:0},
  {type:'pinetree',label:'Pine Tree',icon:'🌲',tiles:[4.5,8.5],top:0},
  {type:'stonearch',label:'Stone Arch',icon:'🏛️',tiles:[6,6],top:0},
  {type:'gazebo',label:'Garden Gazebo',icon:'🏕️',tiles:[7,6],top:0},
  {type:'windmill',label:'Windmill',icon:'🌬️',tiles:[7,10],top:0},
  {type:'fountain',label:'Stone Fountain',icon:'⛲',tiles:[4.5,4],top:4},
  {type:'signpost',label:'Trail Sign',icon:'🪧',tiles:[2.5,3],top:0},
  {type:'pumpkin',label:'Pumpkin Light',icon:'🎃',tiles:[2,1.8],top:8}
] as const;
/** The tree kinds above, shown next to the Oak in the build menu */
export const TREE_TYPES: readonly string[] = ['cherrytree', 'autumntree', 'youngtree', 'sapling'];
export type ExtraBuildType = typeof BUILD_ITEMS[number]['type'];
