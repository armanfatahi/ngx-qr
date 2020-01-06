export class ReedSolomon {
  logger: any;
  n_ec_bytes: any;
  n_degree_max: any;
  syndroms: any;
  gen_poly: any;
  bytes_in: any;
  bytes_out: any;
  corrected: any;
  gexp: any;
  n_errors: any;
  uncorrected_reason: any;
  error_locs: any;
  omega: any;
  psi: any;
  glog: any;

  constructor(n_ec_bytes: any) {
    this.logger = null;
    this.n_ec_bytes = n_ec_bytes;
    this.n_degree_max = 2 * n_ec_bytes;

    this.syndroms = [];

    this.gen_poly = null;
    this.initGaloisTables();
  }


  encode(msg: any) {
    // return parity bytes

    // Simulate a LFSR with generator polynomial for n byte RS code.

    if (this.gen_poly == null) { this.gen_poly = this.genPoly(this.n_ec_bytes); }

    const LFSR = new Array(this.n_ec_bytes + 1);
    for (let i = 0; i < this.n_ec_bytes + 1; i++) { LFSR[i] = 0; }

    for (let i = 0; i < msg.length; i++) {
      const dbyte = msg[i] ^ LFSR[this.n_ec_bytes - 1];
      for (let j = this.n_ec_bytes - 1; j > 0; j--) {
        LFSR[j] = LFSR[j - 1] ^ this.gmult(this.gen_poly[j], dbyte);
      }
      LFSR[0] = this.gmult(this.gen_poly[0], dbyte);
    }

    const parity = [];
    for (let i = this.n_ec_bytes - 1; i >= 0; i--) { parity.push(LFSR[i]); }
    return parity;
  }


  /* ************************************************************ */
  decode(bytes_in: any) {
    this.bytes_in = bytes_in;

    this.bytes_out = bytes_in.slice();

    const n_err = this.calculateSyndroms();
    if (n_err > 0) {
      this.correctErrors();
    } else {
      this.corrected = true;
    }

    return this.bytes_out.slice(0, this.bytes_out.length - this.n_ec_bytes);

  }


  /* ************************************************************
	 * ReedSolomon IMPLEMENTATION
	 * ************************************************************
	 */

  genPoly(nbytes: any) {
    let tp;
    let tp1;
    let genpoly;

    // multiply (x + a^n) for n = 1 to nbytes

    tp1 = this.zeroPoly();
    tp1[0] = 1;

    let i;
    for (i = 0; i < nbytes; i++) {
      tp = this.zeroPoly();
      tp[0] = this.gexp[i];		// set up x+a^n
      tp[1] = 1;
      genpoly = this.multPolys(tp, tp1);
      tp1 = this.copyPoly(genpoly);
    }

    if (this.logger && genpoly) {
      this.logger.debug('RS genPoly: ' + genpoly.join(','));
    }

    return genpoly;
  }


  /* ************************************************************ */
  calculateSyndroms() {
    this.syndroms = [];
    let sum;
    let n_err = 0;
    let i, j;
    for (j = 0; j < this.n_ec_bytes; j++) {
      sum = 0;
      for (i = 0; i < this.bytes_in.length; i++) {
        sum = this.bytes_in[i] ^ this.gmult(this.gexp[j], sum);
      }
      this.syndroms.push(sum);
      if (sum > 0) { n_err++; }
    }
    if (this.logger) {
      if (n_err > 0) {
        this.logger.debug(' RS calculateSyndroms: <b>Errors found!</b> syndroms = ' + this.syndroms.join(' ,'));
      } else {
        this.logger.debug(' RS calculateSyndroms: <b>No errors</b>');
      }
    }
    return n_err;
  }


  /* ************************************************************ */
  correctErrors() {

    this.berlekampMassey();
    this.findRoots();

    this.corrected = false;

    if (2 * this.n_errors > this.n_ec_bytes) {
      this.uncorrected_reason = ' too many errors';
      if (this.logger) {
        this.logger.debug(' RS correctErrors: <b>' + this.uncorrected_reason + ' </b>');
      }
      return;
    }

    let e;
    for (e = 0; e < this.n_errors; e++) {
      if (this.error_locs[e] >= this.bytes_in.length) {
        this.uncorrected_reason = ' corrections out of scope';
        if (this.logger) {
          this.logger.debug(' RS correctErrors: <b>' + this.uncorrected_reason + ' </b>');
        }
        return;
      }
    }

    if (this.n_errors === 0) {
      this.uncorrected_reason = ' could not identify errors';
      if (this.logger) {
        this.logger.debug(' RS correctErrors: <b>' + this.uncorrected_reason + ' </b>');
      }
      return;
    }

    let r;
    for (r = 0; r < this.n_errors; r++) {

      const i = this.error_locs[r];

      // evaluate omega at alpha^(-i)
      let num = 0;
      for (let j = 0; j < this.n_degree_max; j++) {
        num ^= this.gmult(this.omega[j], this.gexp[((255 - i) * j) % 255]);

      }

      // evaluate psi' (derivative) at alpha^(-i) ; all odd powers disappear
      let denom = 0;
      for (let j = 0; j < this.n_degree_max; j += 2) {
        denom ^= this.gmult(this.psi[j], this.gexp[((255 - i) * (j)) % 255]);
      }

      const err = this.gmult(num, this.ginv(denom));
      if (this.logger) {
        // tslint:disable-next-line:max-line-length
        this.logger.debug(' RS correctErrors: loc=' + (this.bytes_out.length - i - 1) + '   err = 0x0' + err.toString(16) + '  = bin ' + err.toString(2));
      }
      this.bytes_out[this.bytes_out.length - i - 1] ^= err;
    }

    this.corrected = true;
  }


  /* ************************************************************ */
  berlekampMassey() {

    /* initialize Gamma, the erasure locator polynomial */
    const gamma = this.zeroPoly();
    gamma[0] = 1;

    /* initialize to z */
    const D = this.copyPoly(gamma);
    this.mulZPoly(D);

    this.psi = this.copyPoly(gamma);
    const psi2 = new Array(this.n_degree_max);
    let k = -1;
    let L = 0;
    let i;
    let n;

    for (n = 0; n < this.n_ec_bytes; n++) {

      const d = this.computeDiscrepancy(this.psi, this.syndroms, L, n);

      if (d !== 0) {

        /* psi2 = psi - d*D */
        for (i = 0; i < this.n_degree_max; i++) {
          psi2[i] = this.psi[i] ^ this.gmult(d, D[i]);
        }

        if (L < (n - k)) {
          const L2 = n - k;
          k = n - L;
          /* D = scale_poly(ginv(d), psi); */
          for (i = 0; i < this.n_degree_max; i++) {
            D[i] = this.gmult(this.psi[i], this.ginv(d));
          }
          L = L2;
        }

        /* psi = psi2 */
        // for (i = 0; i < this.n_degree_max; i++) this.psi[i] = psi2[i];
        this.psi = this.copyPoly(psi2);
      }

      this.mulZPoly(D);
    }

    if (this.logger) {
      this.logger.debug(' RS berlekampMassey: psi = ' + this.psi.join(' ,'));
    }

    /* omega */
    const om = this.multPolys(this.psi, this.syndroms);
    this.omega = this.zeroPoly();
    for (i = 0; i < this.n_ec_bytes; i++) {
      this.omega[i] = om[i];
    }

    if (this.logger) {
      this.logger.debug(' RS berlekampMassey: omega = ' + this.omega.join(' ,'));
    }

  }


  /* ************************************************************ */
  findRoots() {
    this.n_errors = 0;
    this.error_locs = [];
    let sum;
    let r;
    for (r = 1; r < 256; r++) {
      sum = 0;
      /* evaluate psi at r */
      let k;
      for (k = 0; k < this.n_ec_bytes + 1; k++) {
        sum ^= this.gmult(this.gexp[(k * r) % 255], this.psi[k]);
      }
      if (sum === 0) {
        this.error_locs.push(255 - r);
        this.n_errors++;
      }
    }
    if (this.logger) {
      this.logger.debug(' RS findRoots: errors=<b>' + this.n_errors + ' </b> locations = ' + this.error_locs.join(' ,'));
    }
  }


  /* ************************************************************
	 * Polynome functions
	 * ************************************************************
	 */

  computeDiscrepancy(lambda: any, S: any, L: any, n: any) {
    let sum = 0;
    let i;
    for (i = 0; i <= L; i++) {
      sum ^= this.gmult(lambda[i], S[n - i]);
    }
    return sum;
  }

  /* ************************************************************ */
  copyPoly(src: any) {
    const dst = new Array(this.n_degree_max);
    let i;
    for (i = 0; i < this.n_degree_max; i++) {
      dst[i] = src[i];
    }
    return dst;
  }

  /* ************************************************************ */
  zeroPoly() {
    const poly = new Array(this.n_degree_max);
    let i;
    for (i = 0; i < this.n_degree_max; i++) {
      poly[i] = 0;
    }
    return poly;
  }

  /* ************************************************************ */
  mulZPoly(poly: any) {
    let i;
    for (i = this.n_degree_max - 1; i > 0; i--) {
      poly[i] = poly[i - 1];
    }
    poly[0] = 0;
  }

  /* ************************************************************ */
  /* polynomial multiplication */
  multPolys(p1: any, p2: any) {
    const dst = new Array(this.n_degree_max);
    const tmp1 = new Array(this.n_degree_max * 2);

    let i;
    for (i = 0; i < (this.n_degree_max * 2); i++) { dst[i] = 0; }

    for (i = 0; i < this.n_degree_max; i++) {
      let j;
      for (j = this.n_degree_max; j < (this.n_degree_max * 2); j++) { tmp1[j] = 0; }

      /* scale tmp1 by p1[i] */
      for (j = 0; j < this.n_degree_max; j++) { tmp1[j] = this.gmult(p2[j], p1[i]); }
      /* and mult (shift) tmp1 right by i */
      for (j = (this.n_degree_max * 2) - 1; j >= i; j--) { tmp1[j] = tmp1[j - i]; }
      for (j = 0; j < i; j++) { tmp1[j] = 0; }

      /* add into partial product */
      for (j = 0; j < (this.n_degree_max * 2); j++) { dst[j] ^= tmp1[j]; }
    }
    return dst;
  }


  /* ************************************************************
	 * Galois Field functions
	 * ************************************************************
	 */

  initGaloisTables() {

    let pinit = 0;
    let p1 = 1;
    let p2 = 0;
    let p3 = 0;
    let p4 = 0;
    let p5 = 0;
    let p6 = 0;
    let p7 = 0;
    let p8 = 0;

    this.gexp = new Array(512);
    this.glog = new Array(256);

    this.gexp[0] = 1;
    this.gexp[255] = this.gexp[0];
    this.glog[0] = 0;

    let i;
    for (i = 1; i < 256; i++) {
      pinit = p8;
      p8 = p7;
      p7 = p6;
      p6 = p5;
      p5 = p4 ^ pinit;
      p4 = p3 ^ pinit;
      p3 = p2 ^ pinit;
      p2 = p1;
      p1 = pinit;
      this.gexp[i] = p1 + p2 * 2 + p3 * 4 + p4 * 8 + p5 * 16 + p6 * 32 + p7 * 64 + p8 * 128;
      this.gexp[i + 255] = this.gexp[i];
    }

    for (i = 1; i < 256; i++) {
      let z;
      for (z = 0; z < 256; z++) {
        if (this.gexp[z] === i) {
          this.glog[i] = z;
          break;
        }
      }
    }

  }

  /* ************************************************************ */
  gmult(a: any, b: any) {
    if (a === 0 || b === 0) { return (0); }
    const i = this.glog[a];
    const j = this.glog[b];
    return this.gexp[i + j];
  }

  /* ************************************************************ */
  ginv(elt: any) {
    return (this.gexp[255 - this.glog[elt]]);
  }
};

