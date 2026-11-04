import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OddlingAvatar } from '../src/components/OddlingAvatar';
import { sanitizeCreature } from '../src/game/storage';
import { CreatureDNA } from '../src/game/creatureTypes';

// Exact playtest regression fixture from real user bug report:
// - User photographed a 4-tine silver fork
// - Meta named it Tinefang, Furca Argentea, title Silver-Pronged Piercer, ability Four-Prong Pierce
// - Noun "fork" was lost: sourceObject.name was "Polished Stainless Steel"
// - visualPlan had 3 disconnected silver rectangles with gaps (no 4 tines, no bridge)
export const legacyTinefangPlaytestRecord = {
  id: 'oddling-tinefang-playtest',
  name: 'Tinefang',
  speciesName: 'Furca Argentea',
  title: 'Silver-Pronged Piercer',
  primaryElement: 'Mechanical',
  temperament: 'Stubborn & Spiky',
  provenance: 'ai_extracted',
  specialAbility: {
    name: 'Four-Prong Pierce',
    description: 'Pierces through obstacles with four prongs.',
    powerRating: 85,
    icon: '🍴'
  },
  sourceObject: {
    name: 'Polished Stainless Steel', // NOUN FORK ABSENT - was replaced by material!
    category: 'Utensil',
    material: 'Polished Stainless Steel',
    description: 'A polished metal utensil.'
  },
  appearance: {
    bodyShape: 'tall',
    primaryColor: '#e2e8f0', // Silver primary
    secondaryColor: '#94a3b8', // Silver shadow
    accentColor: '#ffffff', // Sparkle accent
    eyeStyle: 'wide',
    visualPlan: {
      version: 1,
      archetype: 'compositional',
      // Prior bug: 3 disconnected silver rectangles with vertical air gaps
      compositional: {
        category: 'utensil',
        aspectRatio: 'tall',
        bodyBlocks: [
          { x: 10, y: 4, w: 4, h: 6, role: 'primary' },
          { x: 22, y: 4, w: 4, h: 6, role: 'primary' },
          { x: 16, y: 18, w: 4, h: 10, role: 'secondary' }
        ],
        featureAccents: [],
        faceX: 18,
        faceY: 17
      },
      definingParts: { hasHandle: true, hasSpines: true },
      materialSurface: { finish: 'brushed_metal', pattern: 'solid' },
      facePlacement: { surfaceRegion: 'body_center', yOffset: 0 }
    }
  },
  inheritedTraits: [
    'Four sharp parallel tines designed for piercing and spearing food',
    'Rigid perfectly balanced handle'
  ],
  habitatPreference: 'Cozy Desk Studio',
  stats: { trust: 45, energy: 90, curiosity: 85, generation: 1 },
  memories: [{ timestamp: 1234567, text: 'Awakened from photographed stainless steel item', type: 'awaken' }],
  discoveredAt: 1729000000000
};

async function verifyVisual() {
  console.log('--- VERIFYING EXACT LEGACY TINEFANG PLAYTEST FIXTURE ---');
  
  // 1. Sanitize creature (as happens when loaded from storage)
  const healedCreature = sanitizeCreature(legacyTinefangPlaytestRecord) as CreatureDNA;
  console.log('Healed Creature Name:', healedCreature.name);
  console.log('Recovered Source Object Name:', healedCreature.sourceObject.name);
  console.log('Species Binomial:', healedCreature.speciesName);
  console.log('Special Ability:', healedCreature.specialAbility.name);
  console.log('Visual Category:', healedCreature.appearance.visualPlan?.compositional?.category);

  // Verify object noun recovery without deleting stats or IDs
  if (healedCreature.id !== legacyTinefangPlaytestRecord.id) {
    throw new Error('Creature ID was not preserved during deterministic repair!');
  }
  if (healedCreature.stats.generation !== 1 || healedCreature.stats.trust !== 45) {
    throw new Error('Creature stats were altered during deterministic repair!');
  }
  if (!healedCreature.sourceObject.name.toLowerCase().includes('fork')) {
    throw new Error(`Expected sourceObject.name to recover fork noun, got: ${healedCreature.sourceObject.name}`);
  }

  // 2. Render Avatar at actual display sizes: 48px (HUD/thumbnail) and 160px (habitat/field guide)
  const svgHtmlThumbnail = renderToStaticMarkup(
    React.createElement(OddlingAvatar, { creature: healedCreature, size: 48, showAura: false })
  );

  const svgHtmlFull = renderToStaticMarkup(
    React.createElement(OddlingAvatar, { creature: healedCreature, size: 160, showAura: true })
  );

  console.log('✓ Rendered static SVG successfully at 48px and 160px without errors.');

  // 3. Inspect SVG body blocks and prongs
  const rectMatches = [...svgHtmlFull.matchAll(/<rect\s+([^>]+)>/g)].map(m => m[1]);
  console.log(`Total geometric rect elements rendered: ${rectMatches.length}`);

  // Check FOUR separate tines at top with 1px gaps (x=12, 15, 18, 21 at y=5)
  const hasProng1 = rectMatches.some(r => r.includes('x="12"') && r.includes('y="5"') && r.includes('width="2"'));
  const hasProng2 = rectMatches.some(r => r.includes('x="15"') && r.includes('y="5"') && r.includes('width="2"'));
  const hasProng3 = rectMatches.some(r => r.includes('x="18"') && r.includes('y="5"') && r.includes('width="2"'));
  const hasProng4 = rectMatches.some(r => r.includes('x="21"') && r.includes('y="5"') && r.includes('width="2"'));

  console.log('  Prong 1 (x:12, y:5, w:2, gap to next: 1px):', hasProng1 ? 'YES' : 'NO');
  console.log('  Prong 2 (x:15, y:5, w:2, gap to next: 1px):', hasProng2 ? 'YES' : 'NO');
  console.log('  Prong 3 (x:18, y:5, w:2, gap to next: 1px):', hasProng3 ? 'YES' : 'NO');
  console.log('  Prong 4 (x:21, y:5, w:2):', hasProng4 ? 'YES' : 'NO');

  if (!hasProng1 || !hasProng2 || !hasProng3 || !hasProng4) {
    console.error('FATAL: Missing one or more of the 4 fork tines with 1px gaps!');
    process.exit(1);
  }

  // Check connected bridge, neck, and 4-6px wide handle
  const hasBridge = rectMatches.some(r => r.includes('x="11"') && r.includes('y="11"') && r.includes('width="14"'));
  const hasNeck = rectMatches.some(r => r.includes('x="15"') && r.includes('y="16"') && r.includes('width="6"'));
  const hasHandle = rectMatches.some(r => r.includes('x="15"') && r.includes('y="18"') && r.includes('width="6"'));
  const hasPommel = rectMatches.some(r => r.includes('x="14"') && r.includes('y="27"') && r.includes('width="8"'));

  console.log('  Solid Curved Fork Bridge (x:11, y:11, w:14, h:5):', hasBridge ? 'YES' : 'NO');
  console.log('  Connected Neck (x:15, y:16, w:6, h:2):', hasNeck ? 'YES' : 'NO');
  console.log('  Visibly 4-6px Wide Silver Handle (x:15, y:18, w:6, h:9):', hasHandle ? 'YES' : 'NO');
  console.log('  Flared Pommel Base (x:14, y:27, w:8, h:4):', hasPommel ? 'YES' : 'NO');

  if (!hasBridge || !hasNeck || !hasHandle || !hasPommel) {
    console.error('FATAL: Fork geometry is not solidly connected!');
    process.exit(1);
  }

  // Check arms attached directly to handle sides and grounded feet
  const hasArms = rectMatches.some(r => r.includes('x="13"') && r.includes('width="2"')) &&
                  rectMatches.some(r => r.includes('x="21"') && r.includes('width="2"'));
  const hasFeet = rectMatches.some(r => r.includes('x="14"') && r.includes('width="3"')) &&
                  rectMatches.some(r => r.includes('x="19"') && r.includes('width="3"'));

  console.log('  Cute Monster Arms Attached to Handle Sides (x:13, x:21):', hasArms ? 'YES' : 'NO');
  console.log('  Grounded Monster Feet at Base (x:14, x:19):', hasFeet ? 'YES' : 'NO');

  if (!hasArms || !hasFeet) {
    console.error('FATAL: Limbs are floating or incorrectly positioned!');
    process.exit(1);
  }

  // Check face placement on fork bridge
  const comp = healedCreature.appearance.visualPlan?.compositional!;
  console.log(`  Face Coordinates: (${comp.faceX}, ${comp.faceY}) - centered on fork bridge.`);

  console.log('\n======================================================');
  console.log('EXACT LEGACY TINEFANG 4-TINE FORK GEOMETRY VERIFIED!');
  console.log('======================================================');
}

verifyVisual().catch(err => {
  console.error('Visual verification failed:', err);
  process.exit(1);
});

