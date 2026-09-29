export const schema = {
  type: 'object',
  properties: {
    clock: {
      type: 'object',
      properties: {
        preset: {
          type: 'string',
          enum: ['plain', 'preframed', 'analog-plain', 'analog-preframed', 'analog-digitalized-preframed'],
        },
        format: {
          type: 'string',
          description: 'Tokens: HH/H, hh/h, mm/m, ss/s, A (AM/PM), a (am/pm). Use [words] for literal text, /n for a line break, /t for a tab, and // for a slash.',
        },
        showAmPm: {
          type: 'boolean',
          description: 'Show meridiem tokens (A or a) when true.',
        },
        color: {
          type: 'string',
          description: 'CSS color used for the clock text.',
        },
        frameColor: { type: 'string' },
        backgroundColor: { type: 'string' },
        textColor: { type: 'string' },
        analogColor: { type: 'string' },
        fontFamily: {
          type: 'string',
        },
        fontSize: {
          type: ['string', 'number'],
        },
        fontWeight: {
          type: ['string', 'number'],
        },
        letterSpacing: {
          type: ['string', 'number'],
        },
        lineHeight: {
          type: ['string', 'number'],
        },
        size: { type: ['string', 'number'], description: 'Analog clock diameter.' },
        lineThickness: { type: 'number', description: 'Scale for analog hand thickness.' },
        showSeconds: { type: 'boolean' },
        backgroundOpacity: {
          type: 'number',
          description: 'Transparent by default; percentage from 0 to 100.',
        },
        borderOpacity: {
          type: 'number',
          description: 'Percentage from 0 to 100.',
        },
        borderRadius: { type: 'string' },
        borderWidth: { type: 'string' },
        padding: { type: 'string' },
        digitalPosition: {
          type: 'string',
          enum: ['top', 'bottom', 'left', 'right'],
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;
