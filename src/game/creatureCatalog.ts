/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PhotoScene, FoodTreat, CreatureDNA } from './creatureTypes';

export const PHOTO_SCENES: PhotoScene[] = [
  {
    id: 'scene-desk',
    title: "The Creator's Desk",
    subtitle: 'Everyday creative workbench littered with gadgets & botanicals',
    description: 'A morning workspace bathed in warm sunlight. Coffee steam wafts near a spiky desk cactus and an amber mechanical lamp.',
    theme: 'desk',
    imageUrl: 'desk',
    objects: [
      {
        id: 'obj-coffee-mug',
        name: 'Ceramic Coffee Mug',
        category: 'Drinkware',
        material: 'Glazed Stoneware',
        defaultElement: 'Ceramic',
        description: 'Warm speckled ceramic mug radiating comforting heat and fresh espresso scent.',
        center: [32, 64],
        maskPolygon: [
          [24, 52], [38, 51], [42, 60], [42, 74], [39, 82], [26, 82], [22, 72], [18, 64], [23, 54]
        ],
        colorPalette: {
          primary: '#e07a5f',
          secondary: '#f4f1de',
          accent: '#3d405b'
        },
        icon: '☕'
      },
      {
        id: 'obj-cactus',
        name: 'Mini Desert Cactus',
        category: 'Houseplant',
        material: 'Organic / Spines',
        defaultElement: 'Botanical',
        description: 'Small barrel cactus with needle-sharp golden spines, soaking up indirect sunlight in a terracotta pot.',
        center: [72, 58],
        maskPolygon: [
          [66, 44], [78, 42], [82, 55], [80, 72], [76, 84], [64, 84], [62, 68], [63, 50]
        ],
        colorPalette: {
          primary: '#2d6a4f',
          secondary: '#74c69d',
          accent: '#d8f3dc'
        },
        icon: '🌵'
      },
      {
        id: 'obj-desk-lamp',
        name: 'Brass Pivot Lamp',
        category: 'Lighting',
        material: 'Brushed Brass & Glass',
        defaultElement: 'Electric',
        description: 'Adjustable gooseneck task lamp with a warm halogen filament and gleaming brass joints.',
        center: [50, 28],
        maskPolygon: [
          [40, 14], [58, 12], [62, 25], [56, 38], [52, 48], [46, 48], [44, 30]
        ],
        colorPalette: {
          primary: '#f39c12',
          secondary: '#f1c40f',
          accent: '#e67e22'
        },
        icon: '💡'
      },
      {
        id: 'obj-headphones',
        name: 'Studio Headphones',
        category: 'Audio',
        material: 'Acoustic Foam & Steel',
        defaultElement: 'Sonic',
        description: 'Over-ear studio monitoring headphones with plush velour ear cushions and coiled cable.',
        center: [82, 30],
        maskPolygon: [
          [74, 18], [90, 16], [94, 32], [90, 44], [78, 42], [72, 30]
        ],
        colorPalette: {
          primary: '#3a86ff',
          secondary: '#8338ec',
          accent: '#ff006e'
        },
        icon: '🎧'
      }
    ]
  },
  {
    id: 'scene-kitchen',
    title: 'Cozy Kitchen Nook',
    subtitle: 'Aromatic culinary tools, honey pots & fresh citrus',
    description: 'A rustic wooden kitchen counter with an artisanal teapot, clover honey jar, and sun-ripened lemons.',
    theme: 'kitchen',
    imageUrl: 'kitchen',
    objects: [
      {
        id: 'obj-honey-jar',
        name: 'Raw Clover Honey Jar',
        category: 'Pantry',
        material: 'Fluted Glass & Amber Nectar',
        defaultElement: 'Crystalline',
        description: 'Hexagonal glass jar full of viscous, golden wildflowers honey that captures light like liquid amber.',
        center: [28, 54],
        maskPolygon: [
          [20, 42], [36, 40], [38, 62], [34, 76], [22, 76], [18, 58]
        ],
        colorPalette: {
          primary: '#f9a825',
          secondary: '#fff8e1',
          accent: '#ff8f00'
        },
        icon: '🍯'
      },
      {
        id: 'obj-cast-iron-teapot',
        name: 'Tetsubin Iron Teapot',
        category: 'Cookware',
        material: 'Pebbled Cast Iron',
        defaultElement: 'Thermal',
        description: 'Heavy Japanese cast iron kettle adorned with a relief of wave motifs and curled spout.',
        center: [65, 52],
        maskPolygon: [
          [52, 38], [76, 36], [82, 52], [78, 74], [56, 74], [48, 58]
        ],
        colorPalette: {
          primary: '#264653',
          secondary: '#2a9d8f',
          accent: '#e76f51'
        },
        icon: '🫖'
      },
      {
        id: 'obj-fresh-lemon',
        name: 'Meyer Lemon',
        category: 'Fruit',
        material: 'Citrus Zest & Pulp',
        defaultElement: 'Botanical',
        description: 'Vibrant yellow Meyer lemon with sweet floral fragrance and dew droplets clinging to its rind.',
        center: [45, 76],
        maskPolygon: [
          [38, 70], [52, 68], [56, 82], [48, 90], [38, 86]
        ],
        colorPalette: {
          primary: '#ffe600',
          secondary: '#a7c957',
          accent: '#6a994e'
        },
        icon: '🍋'
      }
    ]
  },
  {
    id: 'scene-vintage',
    title: "Curator's Cabinet",
    subtitle: 'Antique instruments, brass clocks & leather journals',
    description: 'An explorer’s cabinet of wonders featuring mechanical pocket watches, leatherbound codices, and crystal prisms.',
    theme: 'vintage',
    imageUrl: 'vintage',
    objects: [
      {
        id: 'obj-pocket-watch',
        name: 'Chronograph Pocket Watch',
        category: 'Horology',
        material: 'Engraved Brass & Sapphire Glass',
        defaultElement: 'Chrono',
        description: 'Open-face mechanical watch with exposed ticking tourbillon and Roman numeral blued hands.',
        center: [34, 60],
        maskPolygon: [
          [24, 46], [42, 44], [46, 64], [40, 80], [26, 80], [20, 60]
        ],
        colorPalette: {
          primary: '#b08968',
          secondary: '#e6ccb2',
          accent: '#7f5539'
        },
        icon: '⏱️'
      },
      {
        id: 'obj-magnifying-glass',
        name: 'Brass Loupe Lens',
        category: 'Optics',
        material: 'Optical Crown Glass',
        defaultElement: 'Glass',
        description: 'Heavy handheld magnifier with concentric convex glass that focuses beams of light into crisp halos.',
        center: [70, 50],
        maskPolygon: [
          [58, 38], [80, 36], [84, 56], [78, 72], [64, 70]
        ],
        colorPalette: {
          primary: '#00b4d8',
          secondary: '#90e0ef',
          accent: '#0077b6'
        },
        icon: '🔍'
      }
    ]
  }
];

export const FOOD_TREATS: FoodTreat[] = [
  {
    id: 'treat-espresso-berry',
    name: 'Espresso Bean Puff',
    element: 'Thermal',
    icon: '☕',
    description: 'Roasted coffee crumb that gives warm creatures cozy energy.',
    color: '#e07a5f'
  },
  {
    id: 'treat-solar-dew',
    name: 'Sunlit Chlorophyll Dew',
    element: 'Botanical',
    icon: '🌱',
    description: 'Pure photosynthesized nectar loved by plants and spines.',
    color: '#52b788'
  },
  {
    id: 'treat-volt-chip',
    name: 'Micro-Volt Pretzel',
    element: 'Electric',
    icon: '⚡',
    description: 'A crisp, crackling byte snack with pleasant tingling current.',
    color: '#ffb703'
  },
  {
    id: 'treat-harmonic-candy',
    name: 'Harmonic Sugar Ring',
    element: 'Sonic',
    icon: '🎵',
    description: 'Vibrating crystal sweet that hums a middle-C melody when licked.',
    color: '#8338ec'
  },
  {
    id: 'treat-amber-honeycomb',
    name: 'Amber Honeycomb Fragment',
    element: 'Crystalline',
    icon: '🍯',
    description: 'Crisp hexagonal honeycomb that fills creatures with bliss.',
    color: '#fb8500'
  }
];

export const INITIAL_ODDLINGS: CreatureDNA[] = [
  {
    id: 'oddling-thornbrew',
    name: 'Thornbrew',
    speciesName: 'Calefactus Spinosus',
    title: 'The Steam-Spined Dweller',
    primaryElement: 'Ceramic',
    secondaryElement: 'Botanical',
    temperament: 'Sleepy & Warm',
    provenance: 'preset_demo',
    specialAbility: {
      name: 'Steam Spines',
      description: 'Puffs soothing espresso vapor through translucent defensive cactus needles when startled or pleased.',
      powerRating: 78,
      icon: '☕🌵'
    },
    sourceObject: {
      name: 'Coffee Mug + Mini Cactus',
      category: 'Ceramic / Botanical',
      material: 'Glazed Stoneware & Succulent Spines',
      description: 'Born from a desk mug nestled against a sunlit barrel cactus.'
    },
    appearance: {
      visualPlan: {
        version: 1,
        archetype: 'cup',
        proportions: { widthScale: 1.05, heightScale: 1.0 },
        definingParts: {
          hasHandle: true,
          handleSide: 'right',
          hasRim: true,
          hasSpines: true,
          spineDensity: 'dense',
          hasSteam: true,
          liquidFillColor: '#3a1f12'
        },
        materialSurface: {
          finish: 'glazed_ceramic',
          pattern: 'speckled',
          glazeColor: '#c86d51',
          highlightColor: '#ffffff'
        },
        facePlacement: {
          surfaceRegion: 'vessel_front',
          yOffset: 3
        },
        inheritedFeatures: {
          chassisFrom: 'Ceramic Coffee Mug',
          accentsFrom: 'Mini Desert Cactus',
          inheritedPartKeys: ['ceramic_cup_vessel', 'curved_handle', 'desert_cactus_spines', 'espresso_steam_curls']
        }
      },
      bodyShape: 'chubby',
      primaryColor: '#c86d51',
      secondaryColor: '#40916c',
      accentColor: '#ffe8d6',
      eyeStyle: 'sleepy',
      hornStyle: 'spines',
      accessory: 'steam',
      pattern: 'glazed',
      size: 1.05
    },
    habitatPreference: 'Cozy Desk Studio',
    stats: {
      trust: 65,
      energy: 80,
      curiosity: 55,
      generation: 2
    },
    lineage: {
      parentAName: 'Coffee Mug (Ceramic)',
      parentBName: 'Mini Cactus (Botanical)',
      inheritedTraits: [
        'Glazed ceramic cup vessel with open rim & espresso interior',
        'Emerald needle clusters that vent fragrant steam',
        'Loves basking next to warm computer keyboards'
      ]
    },
    memories: [
      {
        timestamp: Date.now() - 3600000 * 2,
        text: 'Awakened from fusion of Ceramic Mug and Barrel Cactus in the Lab!',
        type: 'fuse'
      },
      {
        timestamp: Date.now() - 3600000,
        text: 'Enjoyed warm espresso puffs and cuddled near the desk lamp.',
        type: 'pet'
      }
    ],
    discoveredAt: Date.now() - 3600000 * 2,
    isFavorite: true
  },
  {
    id: 'oddling-luxacanth',
    name: 'Luxacanth',
    speciesName: 'Lumina Spinata',
    title: 'The Bioluminescent Spire',
    primaryElement: 'Electric',
    secondaryElement: 'Botanical',
    temperament: 'Curious & Chirpy',
    provenance: 'preset_demo',
    specialAbility: {
      name: 'Prism Flash',
      description: 'Channels electrical filament glow into its translucent spine tips, bathing its surroundings in emerald warmth.',
      powerRating: 84,
      icon: '💡🌵'
    },
    sourceObject: {
      name: 'Desk Lamp + Mini Cactus',
      category: 'Electric / Botanical',
      material: 'Brass & Bioluminescent Flesh',
      description: 'A synthesis of brass gooseneck lamp illumination and desert succulent tenacity.'
    },
    appearance: {
      visualPlan: {
        version: 1,
        archetype: 'lamp',
        proportions: { widthScale: 1.0, heightScale: 1.05 },
        definingParts: {
          hasBase: true,
          hasStem: true,
          hasShade: true,
          hasSpines: true,
          spineDensity: 'sparse'
        },
        materialSurface: {
          finish: 'polished_brass',
          pattern: 'ribbed',
          glazeColor: '#e9c46a',
          highlightColor: '#fffbeb'
        },
        facePlacement: {
          surfaceRegion: 'shade_center',
          yOffset: 0
        },
        inheritedFeatures: {
          chassisFrom: 'Brass Pivot Lamp',
          accentsFrom: 'Mini Desert Cactus',
          inheritedPartKeys: ['stepped_brass_base', 'articulated_lamp_stem', 'angled_lamp_shade', 'cactus_spine_nodes', 'amber_filament_glow']
        }
      },
      bodyShape: 'tall',
      primaryColor: '#e9c46a',
      secondaryColor: '#2a9d8f',
      accentColor: '#f4a261',
      eyeStyle: 'wide',
      hornStyle: 'buds',
      accessory: 'glow',
      pattern: 'spots',
      size: 0.95
    },
    habitatPreference: 'Sunlit Greenhouse',
    stats: {
      trust: 50,
      energy: 90,
      curiosity: 85,
      generation: 2
    },
    lineage: {
      parentAName: 'Pivot Lamp (Electric)',
      parentBName: 'Mini Cactus (Botanical)',
      inheritedTraits: [
        'Articulated brass lamp stem merged with photosynthetic cactus segments',
        'Soft golden halo that dims when napping'
      ]
    },
    memories: [
      {
        timestamp: Date.now() - 1800000,
        text: 'Chirped happily at the morning sunbeam.',
        type: 'awaken'
      }
    ],
    discoveredAt: Date.now() - 1800000
  }
];
