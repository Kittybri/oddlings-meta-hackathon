export function parseCreatureResponse(choice: any): unknown {
  const fail = () => { throw { status: 502, retryable: true, code: 'MODEL_RESPONSE', message: 'Your creature needs another moment to take shape.' }; };
  if (choice?.finish_reason === 'length') return fail();
  const raw = choice?.message?.content ?? choice?.text;
  const content = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(part => part?.text || '').join('') : '';
  // Accept a complete object surrounded by a Markdown fence or explanatory prose.
  // Never repair truncated JSON or treat reasoning text as the final answer.
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  let value: any;
  try { value = JSON.parse(content.slice(start, end + 1)); } catch { return fail(); }
  if (!value || Array.isArray(value) || typeof value !== 'object') return fail();
  for (const field of ['name', 'recognizedObject', 'material', 'description']) {
    if (typeof value[field] !== 'string' || !value[field].trim()) return fail();
  }
  if (!value.appearance || typeof value.appearance !== 'object' || Array.isArray(value.appearance)) return fail();
  if (!value.specialAbility || typeof value.specialAbility.name !== 'string' || !value.specialAbility.name.trim()) return fail();
  return value;
}
