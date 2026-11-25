/* Minimal Z80 core: enough for the CRIME CITY ZX81 code (no IX/IY, no interrupts) */
(function (root) {
  'use strict';
  var S = 0x80, Z = 0x40, Y = 0x20, H = 0x10, X = 0x08, PV = 0x04, N = 0x02, C = 0x01;
  var PAR = new Uint8Array(256);
  for (var i = 0; i < 256; i++) { var p = 1, v = i; while (v) { p ^= v & 1; v >>= 1; } PAR[i] = p ? PV : 0; }

  function Z80(rd, wr, inp, out) {
    this.rd = rd; this.wr = wr; this.inp = inp; this.out = out;
    this.R = new Uint8Array(8); // B C D E H L - A
    this.f = 0; this.sp = 0; this.pc = 0; this.t = 0;
  }
  var P = Z80.prototype;
  P.HL = function () { return (this.R[4] << 8) | this.R[5]; };
  P.setHL = function (v) { this.R[4] = (v >> 8) & 255; this.R[5] = v & 255; };
  P.rp = function (n) {
    var R = this.R;
    switch (n) { case 0: return (R[0] << 8) | R[1]; case 1: return (R[2] << 8) | R[3];
      case 2: return (R[4] << 8) | R[5]; default: return this.sp; }
  };
  P.setrp = function (n, v) {
    var R = this.R; v &= 0xFFFF;
    switch (n) { case 0: R[0] = v >> 8; R[1] = v & 255; break; case 1: R[2] = v >> 8; R[3] = v & 255; break;
      case 2: R[4] = v >> 8; R[5] = v & 255; break; default: this.sp = v; }
  };
  P.fetch = function () { var v = this.rd(this.pc); this.pc = (this.pc + 1) & 0xFFFF; return v; };
  P.fetch16 = function () { var l = this.fetch(); return l | (this.fetch() << 8); };
  P.rd16 = function (a) { return this.rd(a) | (this.rd((a + 1) & 0xFFFF) << 8); };
  P.wr16 = function (a, v) { this.wr(a, v & 255); this.wr((a + 1) & 0xFFFF, (v >> 8) & 255); };
  P.push = function (v) { this.sp = (this.sp - 1) & 0xFFFF; this.wr(this.sp, v >> 8); this.sp = (this.sp - 1) & 0xFFFF; this.wr(this.sp, v & 255); };
  P.pop = function () { var l = this.rd(this.sp); this.sp = (this.sp + 1) & 0xFFFF; var h = this.rd(this.sp); this.sp = (this.sp + 1) & 0xFFFF; return l | (h << 8); };
  P.get = function (r) { return r === 6 ? this.rd(this.HL()) : this.R[r]; };
  P.set = function (r, v) { if (r === 6) this.wr(this.HL(), v); else this.R[r] = v; };
  P.cond = function (c) {
    var f = this.f;
    switch (c) { case 0: return !(f & Z); case 1: return !!(f & Z); case 2: return !(f & C); case 3: return !!(f & C);
      case 4: return !(f & PV); case 5: return !!(f & PV); case 6: return !(f & S); default: return !!(f & S); }
  };
  // ---- ALU
  P.add8 = function (a, b, c) { var r = a + b + c, o = r & 255;
    this.f = (o & (S | Y | X)) | (o ? 0 : Z) | ((a ^ b ^ r) & H) | (((a ^ r) & (b ^ r) & 0x80) ? PV : 0) | ((r >> 8) & 1); return o; };
  P.sub8 = function (a, b, c) { var r = a - b - c, o = r & 255;
    this.f = (o & (S | Y | X)) | (o ? 0 : Z) | ((a ^ b ^ r) & H) | (((a ^ b) & (a ^ r) & 0x80) ? PV : 0) | N | ((r >> 8) & 1); return o; };
  P.alu = function (op, b) {
    var a = this.R[7], r;
    switch (op) {
      case 0: this.R[7] = this.add8(a, b, 0); break;
      case 1: this.R[7] = this.add8(a, b, this.f & C); break;
      case 2: this.R[7] = this.sub8(a, b, 0); break;
      case 3: this.R[7] = this.sub8(a, b, this.f & C); break;
      case 4: r = a & b; this.R[7] = r; this.f = (r & (S | Y | X)) | (r ? 0 : Z) | H | PAR[r]; break;
      case 5: r = a ^ b; this.R[7] = r; this.f = (r & (S | Y | X)) | (r ? 0 : Z) | PAR[r]; break;
      case 6: r = a | b; this.R[7] = r; this.f = (r & (S | Y | X)) | (r ? 0 : Z) | PAR[r]; break;
      default: this.sub8(a, b, 0); this.f = (this.f & ~(Y | X)) | (b & (Y | X)); break;
    }
  };
  P.inc8 = function (v) { var r = (v + 1) & 255;
    this.f = (this.f & C) | (r & (S | Y | X)) | (r ? 0 : Z) | (((v & 15) === 15) ? H : 0) | (v === 0x7F ? PV : 0); return r; };
  P.dec8 = function (v) { var r = (v - 1) & 255;
    this.f = (this.f & C) | (r & (S | Y | X)) | (r ? 0 : Z) | (((v & 15) === 0) ? H : 0) | (v === 0x80 ? PV : 0) | N; return r; };
  P.add16 = function (a, b) { var r = a + b;
    this.f = (this.f & (S | Z | PV)) | ((r >> 8) & (Y | X)) | (((a ^ b ^ r) >> 8) & H) | ((r >> 16) & 1); return r & 0xFFFF; };
  P.adc16 = function (a, b) { var c = this.f & C, r = a + b + c, o = r & 0xFFFF;
    this.f = ((o >> 8) & (S | Y | X)) | (o ? 0 : Z) | (((a ^ b ^ r) >> 8) & H) | ((((a ^ r) & (b ^ r) & 0x8000)) ? PV : 0) | ((r >> 16) & 1); return o; };
  P.sbc16 = function (a, b) { var c = this.f & C, r = a - b - c, o = r & 0xFFFF;
    this.f = ((o >> 8) & (S | Y | X)) | (o ? 0 : Z) | (((a ^ b ^ r) >> 8) & H) | ((((a ^ b) & (a ^ r) & 0x8000)) ? PV : 0) | N | ((r >> 16) & 1); return o; };
  P.rot = function (k, v) {
    var c, r;
    switch (k) {
      case 0: c = v >> 7; r = ((v << 1) | c) & 255; break;           // RLC
      case 1: c = v & 1; r = (v >> 1) | (c << 7); break;             // RRC
      case 2: c = v >> 7; r = ((v << 1) | (this.f & C)) & 255; break; // RL
      case 3: c = v & 1; r = (v >> 1) | ((this.f & C) << 7); break;   // RR
      case 4: c = v >> 7; r = (v << 1) & 255; break;                 // SLA
      case 5: c = v & 1; r = (v >> 1) | (v & 0x80); break;           // SRA
      case 6: c = v >> 7; r = ((v << 1) | 1) & 255; break;           // SLL
      default: c = v & 1; r = v >> 1; break;                         // SRL
    }
    this.f = (r & (S | Y | X)) | (r ? 0 : Z) | PAR[r] | c; return r;
  };
  var CYC = (function () {
    var t = new Uint8Array(256).fill(4), i;
    for (i = 0; i < 256; i++) {
      if ((i & 0xC7) === 0x06) t[i] = 7;              // LD r,n
      if ((i & 0xC0) === 0x40) t[i] = 4;
      if ((i & 0xC7) === 0x46 || (i & 0xF8) === 0x70) t[i] = 7;
      if ((i & 0xC7) === 0xC6) t[i] = 7;              // ALU n
      if ((i & 0xC0) === 0x80 && (i & 7) === 6) t[i] = 7;
      if ((i & 0xCF) === 0x01) t[i] = 10; if ((i & 0xCF) === 0x03) t[i] = 6; if ((i & 0xCF) === 0x0B) t[i] = 6;
      if ((i & 0xCF) === 0x09) t[i] = 11; if ((i & 0xCF) === 0xC1) t[i] = 10; if ((i & 0xCF) === 0xC5) t[i] = 11;
      if ((i & 0xC7) === 0xC7) t[i] = 11;
      if ((i & 0xC7) === 0xC2) t[i] = 10; if ((i & 0xC7) === 0xC4) t[i] = 10; if ((i & 0xC7) === 0xC0) t[i] = 5;
      if ((i & 0xC7) === 0x34 || (i & 0xC7) === 0x35) t[i] = 4;
    }
    t[0x34] = t[0x35] = 11; t[0x36] = 10; t[0x0A] = t[0x1A] = t[0x02] = t[0x12] = 7; t[0x32] = t[0x3A] = 13; t[0x22] = t[0x2A] = 16;
    t[0xC3] = 10; t[0xC9] = 10; t[0xCD] = 17; t[0x18] = 12; t[0x10] = 8; t[0xE9] = 4; t[0xD3] = t[0xDB] = 11;
    t[0xE3] = 19; t[0xEB] = 4; t[0xF9] = 6; t[0x20] = t[0x28] = t[0x30] = t[0x38] = 7;
    return t;
  })();
  P.step = function () {
    var op = this.fetch(), R = this.R, t = CYC[op], v, r, a, n, d;
    switch (op >> 6) {
      case 1: // LD r,r' / HALT
        if (op === 0x76) throw new Error('HALT at ' + (this.pc - 1).toString(16));
        this.set((op >> 3) & 7, this.get(op & 7)); this.t += t; return t;
      case 2: this.alu((op >> 3) & 7, this.get(op & 7)); this.t += t; return t;
    }
    switch (op) {
      case 0x00: break;
      case 0x01: case 0x11: case 0x21: case 0x31: this.setrp((op >> 4) & 3, this.fetch16()); break;
      case 0x02: this.wr((R[0] << 8) | R[1], R[7]); break;
      case 0x12: this.wr((R[2] << 8) | R[3], R[7]); break;
      case 0x0A: R[7] = this.rd((R[0] << 8) | R[1]); break;
      case 0x1A: R[7] = this.rd((R[2] << 8) | R[3]); break;
      case 0x03: case 0x13: case 0x23: case 0x33: n = (op >> 4) & 3; this.setrp(n, this.rp(n) + 1); break;
      case 0x0B: case 0x1B: case 0x2B: case 0x3B: n = (op >> 4) & 3; this.setrp(n, this.rp(n) - 1); break;
      case 0x04: case 0x0C: case 0x14: case 0x1C: case 0x24: case 0x2C: case 0x34: case 0x3C:
        n = (op >> 3) & 7; this.set(n, this.inc8(this.get(n))); break;
      case 0x05: case 0x0D: case 0x15: case 0x1D: case 0x25: case 0x2D: case 0x35: case 0x3D:
        n = (op >> 3) & 7; this.set(n, this.dec8(this.get(n))); break;
      case 0x06: case 0x0E: case 0x16: case 0x1E: case 0x26: case 0x2E: case 0x36: case 0x3E:
        this.set((op >> 3) & 7, this.fetch()); break;
      case 0x07: v = R[7]; this.f = (this.f & (S | Z | PV)) | ((v >> 7)) | (((v << 1) | (v >> 7)) & (Y | X)); R[7] = ((v << 1) | (v >> 7)) & 255; break;
      case 0x0F: v = R[7]; this.f = (this.f & (S | Z | PV)) | (v & 1); R[7] = (v >> 1) | ((v & 1) << 7); this.f |= R[7] & (Y | X); break;
      case 0x17: v = R[7]; this.f = (this.f & (S | Z | PV)) | (v >> 7); R[7] = ((v << 1) | (this.f & 0 ? 0 : 0)) & 255; break;
      case 0x1F: break;
      case 0x08: break;
      case 0x09: case 0x19: case 0x29: case 0x39: this.setHL(this.add16(this.HL(), this.rp((op >> 4) & 3))); break;
      case 0x10: d = this.fetch(); R[0] = (R[0] - 1) & 255; if (R[0]) { this.pc = (this.pc + (d << 24 >> 24)) & 0xFFFF; t = 13; } break;
      case 0x18: d = this.fetch(); this.pc = (this.pc + (d << 24 >> 24)) & 0xFFFF; break;
      case 0x20: case 0x28: case 0x30: case 0x38: d = this.fetch(); if (this.cond((op >> 3) & 3)) { this.pc = (this.pc + (d << 24 >> 24)) & 0xFFFF; t = 12; } break;
      case 0x22: this.wr16(this.fetch16(), this.HL()); break;
      case 0x2A: this.setHL(this.rd16(this.fetch16())); break;
      case 0x32: this.wr(this.fetch16(), R[7]); break;
      case 0x3A: R[7] = this.rd(this.fetch16()); break;
      case 0x27: throw new Error('DAA unsupported');
      case 0x2F: R[7] ^= 255; this.f = (this.f & (S | Z | PV | C)) | H | N | (R[7] & (Y | X)); break;
      case 0x37: this.f = (this.f & (S | Z | PV)) | C | (R[7] & (Y | X)); break;
      case 0x3F: this.f = (this.f & (S | Z | PV)) | ((this.f & C) ? H : C) | (R[7] & (Y | X)); break;
      case 0xC0: case 0xC8: case 0xD0: case 0xD8: case 0xE0: case 0xE8: case 0xF0: case 0xF8:
        if (this.cond((op >> 3) & 7)) { this.pc = this.pop(); t = 11; } break;
      case 0xC1: case 0xD1: case 0xE1: this.setrp((op >> 4) & 3, this.pop()); break;
      case 0xF1: v = this.pop(); R[7] = v >> 8; this.f = v & 255; break;
      case 0xC5: case 0xD5: case 0xE5: this.push(this.rp((op >> 4) & 3)); break;
      case 0xF5: this.push((R[7] << 8) | this.f); break;
      case 0xC2: case 0xCA: case 0xD2: case 0xDA: case 0xE2: case 0xEA: case 0xF2: case 0xFA:
        a = this.fetch16(); if (this.cond((op >> 3) & 7)) this.pc = a; break;
      case 0xC3: this.pc = this.fetch16(); break;
      case 0xC4: case 0xCC: case 0xD4: case 0xDC: case 0xE4: case 0xEC: case 0xF4: case 0xFC:
        a = this.fetch16(); if (this.cond((op >> 3) & 7)) { this.push(this.pc); this.pc = a; t = 17; } break;
      case 0xCD: a = this.fetch16(); this.push(this.pc); this.pc = a; break;
      case 0xC9: this.pc = this.pop(); break;
      case 0xC6: case 0xCE: case 0xD6: case 0xDE: case 0xE6: case 0xEE: case 0xF6: case 0xFE:
        this.alu((op >> 3) & 7, this.fetch()); break;
      case 0xC7: case 0xCF: case 0xD7: case 0xDF: case 0xE7: case 0xEF: case 0xF7: case 0xFF:
        this.push(this.pc); this.pc = op & 0x38; break;
      case 0xD3: n = this.fetch(); this.out((R[7] << 8) | n, R[7]); break;
      case 0xDB: n = this.fetch(); R[7] = this.inp((R[7] << 8) | n); break;
      case 0xE3: v = this.rd16(this.sp); this.wr16(this.sp, this.HL()); this.setHL(v); break;
      case 0xE9: this.pc = this.HL(); break;
      case 0xEB: v = (R[2] << 8) | R[3]; R[2] = R[4]; R[3] = R[5]; this.setHL(v); break;
      case 0xF3: case 0xFB: break;
      case 0xF9: this.sp = this.HL(); break;
      case 0xCB: t = this.cb(); break;
      case 0xED: t = this.ed(); break;
      default: throw new Error('Unsupported opcode ' + op.toString(16) + ' at ' + ((this.pc - 1) & 0xFFFF).toString(16));
    }
    this.t += t; return t;
  };
  // fix RLA/RRA/RLCA/RRCA properly (separate helpers keep step() readable)
  var step0 = P.step;
  P.step = function () {
    var op = this.rd(this.pc), R = this.R, c, v;
    if (op === 0x17) { this.pc = (this.pc + 1) & 0xFFFF; v = R[7]; c = this.f & C;
      R[7] = ((v << 1) | c) & 255; this.f = (this.f & (S | Z | PV)) | (v >> 7) | (R[7] & (Y | X)); this.t += 4; return 4; }
    if (op === 0x1F) { this.pc = (this.pc + 1) & 0xFFFF; v = R[7]; c = this.f & C;
      R[7] = (v >> 1) | (c << 7); this.f = (this.f & (S | Z | PV)) | (v & 1) | (R[7] & (Y | X)); this.t += 4; return 4; }
    return step0.call(this);
  };
  P.cb = function () {
    var op = this.fetch(), r = op & 7, k = (op >> 3) & 7, v = this.get(r), t = r === 6 ? 15 : 8, res;
    switch (op >> 6) {
      case 0: this.set(r, this.rot(k, v)); break;
      case 1: res = v & (1 << k); this.f = (this.f & C) | H | (res ? 0 : (Z | PV)) | (res & S) | (v & (Y | X)); if (k !== 7) this.f &= ~S; t = r === 6 ? 12 : 8; break;
      case 2: this.set(r, v & ~(1 << k)); break;
      default: this.set(r, v | (1 << k)); break;
    }
    return t;
  };
  P.ed = function () {
    var op = this.fetch(), R = this.R, t = 8, v, n, a, hl, de, bc, i;
    switch (op) {
      case 0x40: case 0x48: case 0x50: case 0x58: case 0x60: case 0x68: case 0x78:
        v = this.inp((R[0] << 8) | R[1]); R[(op >> 3) & 7] = v;
        this.f = (this.f & C) | (v & (S | Y | X)) | (v ? 0 : Z) | PAR[v]; t = 12; break;
      case 0x41: case 0x49: case 0x51: case 0x59: case 0x61: case 0x69: case 0x79:
        this.out((R[0] << 8) | R[1], R[(op >> 3) & 7]); t = 12; break;
      case 0x42: case 0x52: case 0x62: case 0x72: this.setHL(this.sbc16(this.HL(), this.rp((op >> 4) & 3))); t = 15; break;
      case 0x4A: case 0x5A: case 0x6A: case 0x7A: this.setHL(this.adc16(this.HL(), this.rp((op >> 4) & 3))); t = 15; break;
      case 0x43: case 0x53: case 0x63: case 0x73: this.wr16(this.fetch16(), this.rp((op >> 4) & 3)); t = 20; break;
      case 0x4B: case 0x5B: case 0x6B: case 0x7B: this.setrp((op >> 4) & 3, this.rd16(this.fetch16())); t = 20; break;
      case 0x44: v = R[7]; R[7] = this.sub8(0, v, 0); t = 8; break;
      case 0xA0: case 0xA8: case 0xB0: case 0xB8: // LDI LDD LDIR LDDR (one whole instruction)
        do {
          hl = this.HL(); de = (R[2] << 8) | R[3]; bc = (R[0] << 8) | R[1];
          this.wr(de, this.rd(hl));
          if (op & 8) { hl = (hl - 1) & 0xFFFF; de = (de - 1) & 0xFFFF; } else { hl = (hl + 1) & 0xFFFF; de = (de + 1) & 0xFFFF; }
          bc = (bc - 1) & 0xFFFF; this.setHL(hl); R[2] = de >> 8; R[3] = de & 255; R[0] = bc >> 8; R[1] = bc & 255;
          t += (op & 0x10) && bc ? 21 : 16;
        } while ((op & 0x10) && bc);
        this.f = (this.f & (S | Z | C)) | (bc ? PV : 0); t -= 8; break;
      default: throw new Error('Unsupported ED opcode ' + op.toString(16));
    }
    return t;
  };
  root.Z80 = Z80;
  if (typeof module !== 'undefined') module.exports = Z80;
})(typeof window !== 'undefined' ? window : globalThis);
