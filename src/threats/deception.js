/**
 * Honey-Token Active Deception Chamber
 * ====================================
 * Plants high-entropy synthetic canary credentials (AWS, Stripe, GitHub, PEM keys)
 * with strict POSIX 0600 permissions as tripwires.
 * Catches unauthorized agent exfiltration across raw, base64, hex, and url-encoded
 * representations with zero exposure to real company secrets.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class DeceptionChamber {
  constructor(options = {}) {
    this.workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
    this.vaultDir = path.join(this.workspaceRoot, '.sentinel-quarantine');
    this.stateFile = path.join(this.vaultDir, 'deception-vault.json');
    this.sessionSalt = crypto.randomBytes(8).toString('hex');
  }

  /**
   * Generates a realistic synthetic canary token with verifiable entropy.
   * @param {string} prefix e.g. "sk_live_", "AKIA", "ghp_"
   * @param {string} type e.g. "STRIPE", "AWS", "GITHUB"
   * @returns {object} CanaryTokenProfile
   */
  createCanaryToken(prefix, type) {
    const randPart = crypto.randomBytes(8).toString('hex');
    const hashSignature = crypto
      .createHash('sha256')
      .update(type + randPart + this.sessionSalt)
      .digest('hex')
      .slice(0, 10);

    const token = `${prefix}CANARY_DYE_${type}_${hashSignature}_${randPart}`;
    const hexLower = Buffer.from(token, 'utf8').toString('hex');

    const representations = {
      raw: token,
      base64: Buffer.from(token, 'utf8').toString('base64'),
      hex: hexLower,
      hexUpper: hexLower.toUpperCase(),
      urlEncoded: encodeURIComponent(token).replace(/_/g, '%5F'),
      urlEncodedLower: encodeURIComponent(token).replace(/_/g, '%5f'),
    };

    return {
      type,
      token,
      representations,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Plants realistic decoy honeytoken files in workspace with 0600 permissions.
   * @param {string[]} [types=['aws', 'stripe', 'github']]
   * @returns {object[]} Array of planted decoy records
   */
  plantDecoys(types = ['aws', 'stripe', 'github']) {
    if (!fs.existsSync(this.vaultDir)) {
      try {
        fs.mkdirSync(this.vaultDir, { recursive: true });
      } catch {}
    }

    const state = this.loadState();
    const planted = [];

    // 1. AWS Credentials Decoy
    if (types.includes('aws') || types.includes('all')) {
      const canary = this.createCanaryToken('CANARY_DYE_AWS_', 'AWS');
      const decoyPath = path.join(this.workspaceRoot, 'aws_credentials.ini');
      const content = `[default]\naws_access_key_id = AKIAIOSFODNN7CANARY\naws_secret_access_key = ${canary.token}\nregion = us-east-1\noutput = json\n`;

      fs.writeFileSync(decoyPath, content, { mode: 0o600 });
      try { fs.chmodSync(decoyPath, 0o600); } catch {}

      const record = {
        name: 'AWS Credentials Decoy',
        file: 'aws_credentials.ini',
        fullPath: decoyPath,
        type: 'AWS_ACCESS_KEY',
        canary,
        status: 'ARMED',
      };
      state.decoys['aws_credentials.ini'] = record;
      planted.push(record);
    }

    // 2. Stripe Vault Decoy
    if (types.includes('stripe') || types.includes('all')) {
      const canary = this.createCanaryToken('sk_live_', 'STRIPE');
      const decoyPath = path.join(this.workspaceRoot, 'stripe_vault.env');
      const content = `# Production Stripe Payment Gateway Configuration\nSTRIPE_PUBLISHABLE_KEY=pk_live_51Msz829Xk48La92BzxPqR7tY190\nSTRIPE_SECRET_KEY=${canary.token}\nSTRIPE_WEBHOOK_SECRET=whsec_CANARY_DYE_STRIPE_WH_981290\n`;

      fs.writeFileSync(decoyPath, content, { mode: 0o600 });
      try { fs.chmodSync(decoyPath, 0o600); } catch {}

      const record = {
        name: 'Stripe API Vault Decoy',
        file: 'stripe_vault.env',
        fullPath: decoyPath,
        type: 'STRIPE_SECRET_KEY',
        canary,
        status: 'ARMED',
      };
      state.decoys['stripe_vault.env'] = record;
      planted.push(record);
    }

    // 3. GitHub Token Decoy
    if (types.includes('github') || types.includes('all')) {
      const canary = this.createCanaryToken('ghp_', 'GITHUB');
      const decoyPath = path.join(this.workspaceRoot, 'github_tokens.json');
      const content = JSON.stringify(
        {
          organization: 'infrastructure-engineering',
          github_pat: canary.token,
          scopes: ['repo', 'admin:org', 'workflow'],
          environment: 'production',
        },
        null,
        2
      ) + '\n';

      fs.writeFileSync(decoyPath, content, { mode: 0o600 });
      try { fs.chmodSync(decoyPath, 0o600); } catch {}

      const record = {
        name: 'GitHub PAT Decoy',
        file: 'github_tokens.json',
        fullPath: decoyPath,
        type: 'GITHUB_PERSONAL_ACCESS_TOKEN',
        canary,
        status: 'ARMED',
      };
      state.decoys['github_tokens.json'] = record;
      planted.push(record);
    }

    this.saveState(state);
    return planted;
  }

  /**
   * Scans code or text for any active honeytoken across all encoding representations.
   * @param {string} text Code snippet or stream to inspect
   * @returns {object|null} Breach detail if tripped, else null
   */
  inspectTripwire(text) {
    if (!text || typeof text !== 'string') return null;
    const state = this.loadState();
    const decoys = Object.values(state.decoys || {});

    for (const decoy of decoys) {
      const reps = decoy.canary?.representations;
      if (!reps) continue;

      for (const [format, reprVal] of Object.entries(reps)) {
        if (text.includes(reprVal)) {
          // Record breach in state
          state.breaches = state.breaches || [];
          const breach = {
            decoyFile: decoy.file,
            decoyName: decoy.name,
            decoyType: decoy.type,
            token: decoy.canary.token,
            format,
            timestamp: new Date().toISOString(),
          };
          state.breaches.push(breach);
          decoy.status = 'TRIPPED';
          this.saveState(state);

          return {
            tripped: true,
            decoyFile: decoy.file,
            decoyName: decoy.name,
            decoyType: decoy.type,
            token: decoy.canary.token,
            format,
            riskScore: 100,
          };
        }
      }
    }

    return null;
  }

  /**
   * Removes planted decoy files and resets tripwire state.
   */
  cleanDecoys() {
    const state = this.loadState();
    const removed = [];

    for (const [file, decoy] of Object.entries(state.decoys || {})) {
      const fullPath = decoy.fullPath || path.join(this.workspaceRoot, file);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          removed.push(file);
        }
      } catch {}
    }

    state.decoys = {};
    this.saveState(state);
    return removed;
  }

  /**
   * Returns current active status of all decoys and breaches.
   */
  getStatus() {
    const state = this.loadState();
    const decoys = Object.values(state.decoys || {});
    return {
      activeCount: decoys.filter((d) => d.status === 'ARMED').length,
      trippedCount: decoys.filter((d) => d.status === 'TRIPPED').length,
      decoys,
      breaches: state.breaches || [],
    };
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      }
    } catch {}
    return { decoys: {}, breaches: [] };
  }

  saveState(state) {
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
    } catch {}
  }
}

module.exports = {
  DeceptionChamber,
};
