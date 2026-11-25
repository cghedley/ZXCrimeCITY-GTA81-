/* Minimal Z80 core: enough for the CRIME CITY ZX81 code (no IX/IY, no interrupts) */

export class Z80 {
  rd: (a: number) => number;
  wr: (a: number, v: number) => void;
  inp: (port: number) => number;
  out: (port: number, v: number) => void;
  R: Uint8Array; // B C D E H L - A
  f: number;
  sp: number;
  pc: number;
  t: number;

  static S = 0x80;
  static Z = 0x40;
  static Y = 0x20;
  static H = 0x10;
  static X = 0x08;
  static PV = 0x04;
  static N = 0x02;
  static C = 0x01;

  static PAR = (() => {
    const par = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      let p = 1;
      let v = i;
      while (v) {
        p ^= v & 1;
        v >>= 1;
      }
      par[i] = p ? Z80.PV : 0;
    }
    return par;
  })();

  static CYC = (() => {
    const t = new Uint8Array(256).fill(4);
    for (let i = 0; i < 256; i++) {
      if ((i & 0xc7) === 0x06) t[i] = 7;
      if ((i & 0xc0) === 0x40) t[i] = 4;
      if ((i & 0xc7) === 0x46 || (i & 0xf8) === 0x70) t[i] = 7;
      if ((i & 0xc7) === 0xc6) t[i] = 7;
      if ((i & 0xc0) === 0x80 && (i & 7) === 6) t[i] = 7;
      if ((i & 0xcf) === 0x01) t[i] = 10;
      if ((i & 0xcf) === 0x03) t[i] = 6;
      if ((i & 0xcf) === 0x0b) t[i] = 6;
      if ((i & 0xcf) === 0x09) t[i] = 11;
      if ((i & 0xcf) === 0xc1) t[i] = 10;
      if ((i & 0xcf) === 0xc5) t[i] = 11;
      if ((i & 0xc7) === 0xc7) t[i] = 11;
      if ((i & 0xc7) === 0xc2) t[i] = 10;
      if ((i & 0xc7) === 0xc4) t[i] = 10;
      if ((i & 0xc7) === 0xc0) t[i] = 5;
      if ((i & 0xc7) === 0x34 || (i & 0xc7) === 0x35) t[i] = 4;
    }
    t[0x34] = t[0x35] = 11;
    t[0x36] = 10;
    t[0x0a] = t[0x1a] = t[0x02] = t[0x12] = 7;
    t[0x32] = t[0x3a] = 13;
    t[0x22] = t[0x2a] = 16;
    t[0xc3] = 10;
    t[0xc9] = 10;
    t[0xcd] = 17;
    t[0x18] = 12;
    t[0x10] = 8;
    t[0xe9] = 4;
    t[0xd3] = t[0xdb] = 11;
    t[0xe3] = 19;
    t[0xeb] = 4;
    t[0xf9] = 6;
    t[0x20] = t[0x28] = t[0x30] = t[0x38] = 7;
    return t;
  })();

  constructor(
    rd: (a: number) => number,
    wr: (a: number, v: number) => void,
    inp: (port: number) => number,
    out: (port: number, v: number) => void
  ) {
    this.rd = rd;
    this.wr = wr;
    this.inp = inp;
    this.out = out;
    this.R = new Uint8Array(8);
    this.f = 0;
    this.sp = 0;
    this.pc = 0;
    this.t = 0;
  }

  HL(): number {
    return (this.R[4] << 8) | this.R[5];
  }

  setHL(v: number): void {
    this.R[4] = (v >> 8) & 255;
    this.R[5] = v & 255;
  }

  rp(n: number): number {
    const R = this.R;
    switch (n) {
      case 0:
        return (R[0] << 8) | R[1];
      case 1:
        return (R[2] << 8) | R[3];
      case 2:
        return (R[4] << 8) | R[5];
      default:
        return this.sp;
    }
  }

  setrp(n: number, v: number): void {
    const R = this.R;
    v &= 0xffff;
    switch (n) {
      case 0:
        R[0] = v >> 8;
        R[1] = v & 255;
        break;
      case 1:
        R[2] = v >> 8;
        R[3] = v & 255;
        break;
      case 2:
        R[4] = v >> 8;
        R[5] = v & 255;
        break;
      default:
        this.sp = v;
    }
  }

  fetch(): number {
    const v = this.rd(this.pc);
    this.pc = (this.pc + 1) & 0xffff;
    return v;
  }

  fetch16(): number {
    const l = this.fetch();
    return l | (this.fetch() << 8);
  }

  rd16(a: number): number {
    return this.rd(a) | (this.rd((a + 1) & 0xffff) << 8);
  }

  wr16(a: number, v: number): void {
    this.wr(a, v & 255);
    this.wr((a + 1) & 0xffff, (v >> 8) & 255);
  }

  push(v: number): void {
    this.sp = (this.sp - 1) & 0xffff;
    this.wr(this.sp, v >> 8);
    this.sp = (this.sp - 1) & 0xffff;
    this.wr(this.sp, v & 255);
  }

  pop(): number {
    const l = this.rd(this.sp);
    this.sp = (this.sp + 1) & 0xffff;
    const h = this.rd(this.sp);
    this.sp = (this.sp + 1) & 0xffff;
    return l | (h << 8);
  }

  get(r: number): number {
    return r === 6 ? this.rd(this.HL()) : this.R[r];
  }

  set(r: number, v: number): void {
    if (r === 6) this.wr(this.HL(), v);
    else this.R[r] = v;
  }

  cond(c: number): boolean {
    const f = this.f;
    switch (c) {
      case 0:
        return !(f & Z80.Z);
      case 1:
        return !!(f & Z80.Z);
      case 2:
        return !(f & Z80.C);
      case 3:
        return !!(f & Z80.C);
      case 4:
        return !(f & Z80.PV);
      case 5:
        return !!(f & Z80.PV);
      case 6:
        return !(f & Z80.S);
      default:
        return !!(f & Z80.S);
    }
  }

  add8(a: number, b: number, c: number): number {
    const r = a + b + c;
    const o = r & 255;
    this.f =
      (o & (Z80.S | Z80.Y | Z80.X)) |
      (o ? 0 : Z80.Z) |
      ((a ^ b ^ r) & Z80.H) |
      ((a ^ r) & (b ^ r) & 0x80 ? Z80.PV : 0) |
      ((r >> 8) & 1);
    return o;
  }

  sub8(a: number, b: number, c: number): number {
    const r = a - b - c;
    const o = r & 255;
    this.f =
      (o & (Z80.S | Z80.Y | Z80.X)) |
      (o ? 0 : Z80.Z) |
      ((a ^ b ^ r) & Z80.H) |
      ((a ^ b) & (a ^ r) & 0x80 ? Z80.PV : 0) |
      Z80.N |
      ((r >> 8) & 1);
    return o;
  }

  alu(op: number, b: number): void {
    const a = this.R[7];
    let r: number;
    switch (op) {
      case 0:
        this.R[7] = this.add8(a, b, 0);
        break;
      case 1:
        this.R[7] = this.add8(a, b, this.f & Z80.C);
        break;
      case 2:
        this.R[7] = this.sub8(a, b, 0);
        break;
      case 3:
        this.R[7] = this.sub8(a, b, this.f & Z80.C);
        break;
      case 4:
        r = a & b;
        this.R[7] = r;
        this.f = (r & (Z80.S | Z80.Y | Z80.X)) | (r ? 0 : Z80.Z) | Z80.H | Z80.PAR[r];
        break;
      case 5:
        r = a ^ b;
        this.R[7] = r;
        this.f = (r & (Z80.S | Z80.Y | Z80.X)) | (r ? 0 : Z80.Z) | Z80.PAR[r];
        break;
      case 6:
        r = a | b;
        this.R[7] = r;
        this.f = (r & (Z80.S | Z80.Y | Z80.X)) | (r ? 0 : Z80.Z) | Z80.PAR[r];
        break;
      default:
        this.sub8(a, b, 0);
        this.f = (this.f & ~(Z80.Y | Z80.X)) | (b & (Z80.Y | Z80.X));
        break;
    }
  }

  inc8(v: number): number {
    const r = (v + 1) & 255;
    this.f =
      (this.f & Z80.C) |
      (r & (Z80.S | Z80.Y | Z80.X)) |
      (r ? 0 : Z80.Z) |
      ((v & 15) === 15 ? Z80.H : 0) |
      (v === 0x7f ? Z80.PV : 0);
    return r;
  }

  dec8(v: number): number {
    const r = (v - 1) & 255;
    this.f =
      (this.f & Z80.C) |
      (r & (Z80.S | Z80.Y | Z80.X)) |
      (r ? 0 : Z80.Z) |
      ((v & 15) === 0 ? Z80.H : 0) |
      (v === 0x80 ? Z80.PV : 0) |
      Z80.N;
    return r;
  }

  add16(a: number, b: number): number {
    const r = a + b;
    this.f =
      (this.f & (Z80.S | Z80.Z | Z80.PV)) |
      ((r >> 8) & (Z80.Y | Z80.X)) |
      (((a ^ b ^ r) >> 8) & Z80.H) |
      ((r >> 16) & 1);
    return r & 0xffff;
  }

  adc16(a: number, b: number): number {
    const c = this.f & Z80.C;
    const r = a + b + c;
    const o = r & 0xffff;
    this.f =
      ((o >> 8) & (Z80.S | Z80.Y | Z80.X)) |
      (o ? 0 : Z80.Z) |
      (((a ^ b ^ r) >> 8) & Z80.H) |
      ((a ^ r) & (b ^ r) & 0x8000 ? Z80.PV : 0) |
      ((r >> 16) & 1);
    return o;
  }

  sbc16(a: number, b: number): number {
    const c = this.f & Z80.C;
    const r = a - b - c;
    const o = r & 0xffff;
    this.f =
      ((o >> 8) & (Z80.S | Z80.Y | Z80.X)) |
      (o ? 0 : Z80.Z) |
      (((a ^ b ^ r) >> 8) & Z80.H) |
      ((a ^ b) & (a ^ r) & 0x8000 ? Z80.PV : 0) |
      Z80.N |
      ((r >> 16) & 1);
    return o;
  }

  rot(k: number, v: number): number {
    let c: number;
    let r: number;
    switch (k) {
      case 0:
        c = v >> 7;
        r = ((v << 1) | c) & 255;
        break;
      case 1:
        c = v & 1;
        r = (v >> 1) | (c << 7);
        break;
      case 2:
        c = v >> 7;
        r = ((v << 1) | (this.f & Z80.C)) & 255;
        break;
      case 3:
        c = v & 1;
        r = (v >> 1) | ((this.f & Z80.C) << 7);
        break;
      case 4:
        c = v >> 7;
        r = (v << 1) & 255;
        break;
      case 5:
        c = v & 1;
        r = (v >> 1) | (v & 0x80);
        break;
      case 6:
        c = v >> 7;
        r = ((v << 1) | 1) & 255;
        break;
      default:
        c = v & 1;
        r = v >> 1;
        break;
    }
    this.f = (r & (Z80.S | Z80.Y | Z80.X)) | (r ? 0 : Z80.Z) | Z80.PAR[r] | c;
    return r;
  }

  step(): number {
    const peek = this.rd(this.pc);
    const R = this.R;
    let c: number;
    let v: number;

    if (peek === 0x17) {
      this.pc = (this.pc + 1) & 0xffff;
      v = R[7];
      c = this.f & Z80.C;
      R[7] = ((v << 1) | c) & 255;
      this.f = (this.f & (Z80.S | Z80.Z | Z80.PV)) | (v >> 7) | (R[7] & (Z80.Y | Z80.X));
      this.t += 4;
      return 4;
    }
    if (peek === 0x1f) {
      this.pc = (this.pc + 1) & 0xffff;
      v = R[7];
      c = this.f & Z80.C;
      R[7] = (v >> 1) | (c << 7);
      this.f = (this.f & (Z80.S | Z80.Z | Z80.PV)) | (v & 1) | (R[7] & (Z80.Y | Z80.X));
      this.t += 4;
      return 4;
    }

    const op = this.fetch();
    let t = Z80.CYC[op];
    let a: number;
    let n: number;
    let d: number;

    switch (op >> 6) {
      case 1:
        if (op === 0x76) throw new Error('HALT at ' + (this.pc - 1).toString(16));
        this.set((op >> 3) & 7, this.get(op & 7));
        this.t += t;
        return t;
      case 2:
        this.alu((op >> 3) & 7, this.get(op & 7));
        this.t += t;
        return t;
    }

    switch (op) {
      case 0x00:
        break;
      case 0x01:
      case 0x11:
      case 0x21:
      case 0x31:
        this.setrp((op >> 4) & 3, this.fetch16());
        break;
      case 0x02:
        this.wr((R[0] << 8) | R[1], R[7]);
        break;
      case 0x12:
        this.wr((R[2] << 8) | R[3], R[7]);
        break;
      case 0x0a:
        R[7] = this.rd((R[0] << 8) | R[1]);
        break;
      case 0x1a:
        R[7] = this.rd((R[2] << 8) | R[3]);
        break;
      case 0x03:
      case 0x13:
      case 0x23:
      case 0x33:
        n = (op >> 4) & 3;
        this.setrp(n, this.rp(n) + 1);
        break;
      case 0x0b:
      case 0x1b:
      case 0x2b:
      case 0x3b:
        n = (op >> 4) & 3;
        this.setrp(n, this.rp(n) - 1);
        break;
      case 0x04:
      case 0x0c:
      case 0x14:
      case 0x1c:
      case 0x24:
      case 0x2c:
      case 0x34:
      case 0x3c:
        n = (op >> 3) & 7;
        this.set(n, this.inc8(this.get(n)));
        break;
      case 0x05:
      case 0x0d:
      case 0x15:
      case 0x1d:
      case 0x25:
      case 0x2d:
      case 0x35:
      case 0x3d:
        n = (op >> 3) & 7;
        this.set(n, this.dec8(this.get(n)));
        break;
      case 0x06:
      case 0x0e:
      case 0x16:
      case 0x1e:
      case 0x26:
      case 0x2e:
      case 0x36:
      case 0x3e:
        this.set((op >> 3) & 7, this.fetch());
        break;
      case 0x07:
        v = R[7];
        this.f =
          (this.f & (Z80.S | Z80.Z | Z80.PV)) |
          (v >> 7) |
          (((v << 1) | (v >> 7)) & (Z80.Y | Z80.X));
        R[7] = ((v << 1) | (v >> 7)) & 255;
        break;
      case 0x0f:
        v = R[7];
        this.f = (this.f & (Z80.S | Z80.Z | Z80.PV)) | (v & 1);
        R[7] = (v >> 1) | ((v & 1) << 7);
        this.f |= R[7] & (Z80.Y | Z80.X);
        break;
      case 0x08:
        break;
      case 0x09:
      case 0x19:
      case 0x29:
      case 0x39:
        this.setHL(this.add16(this.HL(), this.rp((op >> 4) & 3)));
        break;
      case 0x10:
        d = this.fetch();
        R[0] = (R[0] - 1) & 255;
        if (R[0]) {
          this.pc = (this.pc + ((d << 24) >> 24)) & 0xffff;
          t = 13;
        }
        break;
      case 0x18:
        d = this.fetch();
        this.pc = (this.pc + ((d << 24) >> 24)) & 0xffff;
        break;
      case 0x20:
      case 0x28:
      case 0x30:
      case 0x38:
        d = this.fetch();
        if (this.cond((op >> 3) & 3)) {
          this.pc = (this.pc + ((d << 24) >> 24)) & 0xffff;
          t = 12;
        }
        break;
      case 0x22:
        this.wr16(this.fetch16(), this.HL());
        break;
      case 0x2a:
        this.setHL(this.rd16(this.fetch16()));
        break;
      case 0x32:
        this.wr(this.fetch16(), R[7]);
        break;
      case 0x3a:
        R[7] = this.rd(this.fetch16());
        break;
      case 0x27:
        throw new Error('DAA unsupported');
      case 0x2f:
        R[7] ^= 255;
        this.f =
          (this.f & (Z80.S | Z80.Z | Z80.PV | Z80.C)) | Z80.H | Z80.N | (R[7] & (Z80.Y | Z80.X));
        break;
      case 0x37:
        this.f = (this.f & (Z80.S | Z80.Z | Z80.PV)) | Z80.C | (R[7] & (Z80.Y | Z80.X));
        break;
      case 0x3f:
        this.f =
          (this.f & (Z80.S | Z80.Z | Z80.PV)) |
          (this.f & Z80.C ? Z80.H : Z80.C) |
          (R[7] & (Z80.Y | Z80.X));
        break;
      case 0xc0:
      case 0xc8:
      case 0xd0:
      case 0xd8:
      case 0xe0:
      case 0xe8:
      case 0xf0:
      case 0xf8:
        if (this.cond((op >> 3) & 7)) {
          this.pc = this.pop();
          t = 11;
        }
        break;
      case 0xc1:
      case 0xd1:
      case 0xe1:
        this.setrp((op >> 4) & 3, this.pop());
        break;
      case 0xf1:
        v = this.pop();
        R[7] = v >> 8;
        this.f = v & 255;
        break;
      case 0xc5:
      case 0xd5:
      case 0xe5:
        this.push(this.rp((op >> 4) & 3));
        break;
      case 0xf5:
        this.push((R[7] << 8) | this.f);
        break;
      case 0xc2:
      case 0xca:
      case 0xd2:
      case 0xda:
      case 0xe2:
      case 0xea:
      case 0xf2:
      case 0xfa:
        a = this.fetch16();
        if (this.cond((op >> 3) & 7)) this.pc = a;
        break;
      case 0xc3:
        this.pc = this.fetch16();
        break;
      case 0xc4:
      case 0xcc:
      case 0xd4:
      case 0xdc:
      case 0xe4:
      case 0xec:
      case 0xf4:
      case 0xfc:
        a = this.fetch16();
        if (this.cond((op >> 3) & 7)) {
          this.push(this.pc);
          this.pc = a;
          t = 17;
        }
        break;
      case 0xcd:
        a = this.fetch16();
        this.push(this.pc);
        this.pc = a;
        break;
      case 0xc9:
        this.pc = this.pop();
        break;
      case 0xc6:
      case 0xce:
      case 0xd6:
      case 0xde:
      case 0xe6:
      case 0xee:
      case 0xf6:
      case 0xfe:
        this.alu((op >> 3) & 7, this.fetch());
        break;
      case 0xc7:
      case 0xcf:
      case 0xd7:
      case 0xdf:
      case 0xe7:
      case 0xef:
      case 0xf7:
      case 0xff:
        this.push(this.pc);
        this.pc = op & 0x38;
        break;
      case 0xd3:
        n = this.fetch();
        this.out((R[7] << 8) | n, R[7]);
        break;
      case 0xdb:
        n = this.fetch();
        R[7] = this.inp((R[7] << 8) | n);
        break;
      case 0xe3:
        v = this.rd16(this.sp);
        this.wr16(this.sp, this.HL());
        this.setHL(v);
        break;
      case 0xe9:
        this.pc = this.HL();
        break;
      case 0xeb:
        v = (R[2] << 8) | R[3];
        R[2] = R[4];
        R[3] = R[5];
        this.setHL(v);
        break;
      case 0xf3:
      case 0xfb:
        break;
      case 0xf9:
        this.sp = this.HL();
        break;
      case 0xcb:
        t = this.cb();
        break;
      case 0xed:
        t = this.ed();
        break;
      default:
        throw new Error(
          'Unsupported opcode ' + op.toString(16) + ' at ' + ((this.pc - 1) & 0xffff).toString(16)
        );
    }
    this.t += t;
    return t;
  }

  cb(): number {
    const op = this.fetch();
    const r = op & 7;
    const k = (op >> 3) & 7;
    const v = this.get(r);
    let t = r === 6 ? 15 : 8;
    let res: number;
    switch (op >> 6) {
      case 0:
        this.set(r, this.rot(k, v));
        break;
      case 1:
        res = v & (1 << k);
        this.f =
          (this.f & Z80.C) |
          Z80.H |
          (res ? 0 : Z80.Z | Z80.PV) |
          (res & Z80.S) |
          (v & (Z80.Y | Z80.X));
        if (k !== 7) this.f &= ~Z80.S;
        t = r === 6 ? 12 : 8;
        break;
      case 2:
        this.set(r, v & ~(1 << k));
        break;
      default:
        this.set(r, v | (1 << k));
        break;
    }
    return t;
  }

  ed(): number {
    const op = this.fetch();
    const R = this.R;
    let t = 8;
    let v: number;
    let hl: number;
    let de: number;
    let bc: number;
    switch (op) {
      case 0x40:
      case 0x48:
      case 0x50:
      case 0x58:
      case 0x60:
      case 0x68:
      case 0x78:
        v = this.inp((R[0] << 8) | R[1]);
        R[(op >> 3) & 7] = v;
        this.f = (this.f & Z80.C) | (v & (Z80.S | Z80.Y | Z80.X)) | (v ? 0 : Z80.Z) | Z80.PAR[v];
        t = 12;
        break;
      case 0x41:
      case 0x49:
      case 0x51:
      case 0x59:
      case 0x61:
      case 0x69:
      case 0x79:
        this.out((R[0] << 8) | R[1], R[(op >> 3) & 7]);
        t = 12;
        break;
      case 0x42:
      case 0x52:
      case 0x62:
      case 0x72:
        this.setHL(this.sbc16(this.HL(), this.rp((op >> 4) & 3)));
        t = 15;
        break;
      case 0x4a:
      case 0x5a:
      case 0x6a:
      case 0x7a:
        this.setHL(this.adc16(this.HL(), this.rp((op >> 4) & 3)));
        t = 15;
        break;
      case 0x43:
      case 0x53:
      case 0x63:
      case 0x73:
        this.wr16(this.fetch16(), this.rp((op >> 4) & 3));
        t = 20;
        break;
      case 0x4b:
      case 0x5b:
      case 0x6b:
      case 0x7b:
        this.setrp((op >> 4) & 3, this.rd16(this.fetch16()));
        t = 20;
        break;
      case 0x44:
        v = R[7];
        R[7] = this.sub8(0, v, 0);
        t = 8;
        break;
      case 0xa0:
      case 0xa8:
      case 0xb0:
      case 0xb8:
        do {
          hl = this.HL();
          de = (R[2] << 8) | R[3];
          bc = (R[0] << 8) | R[1];
          this.wr(de, this.rd(hl));
          if (op & 8) {
            hl = (hl - 1) & 0xffff;
            de = (de - 1) & 0xffff;
          } else {
            hl = (hl + 1) & 0xffff;
            de = (de + 1) & 0xffff;
          }
          bc = (bc - 1) & 0xffff;
          this.setHL(hl);
          R[2] = de >> 8;
          R[3] = de & 255;
          R[0] = bc >> 8;
          R[1] = bc & 255;
          t += op & 0x10 && bc ? 21 : 16;
        } while (op & 0x10 && bc);
        this.f = (this.f & (Z80.S | Z80.Z | Z80.C)) | (bc ? Z80.PV : 0);
        t -= 8;
        break;
      default:
        throw new Error('Unsupported ED opcode ' + op.toString(16));
    }
    return t;
  }
}
