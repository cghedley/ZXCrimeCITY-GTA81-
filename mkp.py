import struct
def make_p(code, collapsed=False):
    ln=len(code); ss=793
    b=bytearray()
    w=lambda v: b.extend(struct.pack('<H',v&0xFFFF))
    b.append(0)                 # VERSN
    w(1)                        # E_PPC
    w(16530+ln)                 # D_FILE
    w(16531+ln)                 # DF_CC
    w(16530+ln+ss)              # VARS
    w(0)                        # DEST
    w(16531+ln+ss)              # E_LINE
    w(16535+ln+ss)              # CH_ADD
    w(0)                        # X_PTR
    w(16536+ln+ss)              # STKBOT
    w(16536+ln+ss)              # STKEND
    b.append(0)                 # BERG
    w(16477)                    # MEM
    b.append(0)                 # unused
    b.append(2)                 # DF_SZ
    w(0)                        # S_TOP
    b.append(191); b.append(253)# LAST_K
    b.append(255)               # DB_ST
    b.append(55)                # MARGIN
    w(16509)                    # NXTLIN (autorun)
    w(0)                        # OLDPPC
    b.append(0)                 # FLAGX
    w(0)                        # STRLEN
    w(3213)                     # T_ADDR
    w(0)                        # SEED
    w(63000)                    # FRAMES
    w(0)                        # COORDS
    b.append(188)               # PR_CC
    b.append(33); b.append(24)  # S_POSN
    b.append(64)                # CDFLAG
    for i in range(16): w(0)
    b.append(118)
    for i in range(5): w(0)
    b.append(132); b.append(32)
    for i in range(10): w(0)
    assert len(b)==0x407D-0x4009,len(b)
    # program
    b+= bytes([0,1]); w(ln+2); b.append(234); b+=code; b.append(118)
    b+= bytes([0,2]); w(11); b+= bytes([249,212,197,11,29,34,33,29,32,11,118])
    for c in range(24):
        b.append(118)
        b+=bytes(32)
    b.append(118); b.append(128)
    return bytes(b)
if __name__=='__main__':
    code=open('crime.bin','rb').read()
    p=make_p(code)
    open('crimecity.p','wb').write(p)
    print(len(code),len(p))
