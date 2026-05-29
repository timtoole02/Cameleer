#if defined(__linux__) && defined(__x86_64__)
#include <immintrin.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <sys/syscall.h>
#include <unistd.h>

#ifndef ARCH_REQ_XCOMP_PERM
#define ARCH_REQ_XCOMP_PERM 0x1023
#endif
#ifndef XFEATURE_XTILEDATA
#define XFEATURE_XTILEDATA 18
#endif

typedef struct __attribute__((packed, aligned(64))) {
    uint8_t palette_id;
    uint8_t start_row;
    uint8_t reserved_0[14];
    uint16_t colsb[16];
    uint8_t rows[16];
} camelid_tile_config_t;

typedef struct __attribute__((aligned(16))) {
    float scales[4];
    int8_t quants[128];
} camelid_q8_rows4_block_t;

typedef struct __attribute__((aligned(64))) {
    float scales[16];
    int8_t quants[512];
} camelid_q8_amx_block_t;

static _Thread_local int camelid_amx_state = 0;

int camelid_x86_q8_amx_supported(void) {
#if defined(__GNUC__)
    __builtin_cpu_init();
    return __builtin_cpu_supports("amx-tile") &&
           __builtin_cpu_supports("amx-int8") &&
           __builtin_cpu_supports("avx512f");
#else
    return 0;
#endif
}

int camelid_x86_q8_amx_prepare_thread(void) {
    if (camelid_amx_state == 2) {
        return 1;
    }
    if (camelid_amx_state == -1) {
        return 0;
    }
    if (!camelid_x86_q8_amx_supported()) {
        camelid_amx_state = -1;
        return 0;
    }
    if (syscall(SYS_arch_prctl, ARCH_REQ_XCOMP_PERM, XFEATURE_XTILEDATA) != 0) {
        camelid_amx_state = -1;
        return 0;
    }

    camelid_tile_config_t tc;
    memset(&tc, 0, sizeof(tc));
    tc.palette_id = 1;
    tc.start_row = 0;
    tc.rows[0] = 8;   tc.colsb[0] = 64; // B: K/4 x (16 cols * 4 bytes)
    tc.rows[2] = 16;  tc.colsb[2] = 32; // A: 16 rows x 32 K bytes
    tc.rows[4] = 16;  tc.colsb[4] = 64; // C: 16 rows x 16 i32
    _tile_loadconfig(&tc);
    camelid_amx_state = 2;
    return 1;
}

static inline int8_t camelid_rows4_quant(const camelid_q8_rows4_block_t * block, int lane, int k) {
    const int chunk = k >> 3;
    const int offset = k & 7;
    return block->quants[chunk * 32 + lane * 8 + offset];
}

static inline void camelid_pack_a_tile(
    const camelid_q8_rows4_block_t * input_groups,
    size_t blocks_per_row,
    size_t block_idx,
    size_t m_rows,
    int8_t * a_tile,
    float * a_scales
) {
    memset(a_tile, 0, 16 * 32);
    for (size_t m = 0; m < m_rows; ++m) {
        const size_t group = m >> 2;
        const int lane = (int)(m & 3);
        const camelid_q8_rows4_block_t * block = input_groups + group * blocks_per_row + block_idx;
        a_scales[m] = block->scales[lane];
        int8_t * row = a_tile + m * 32;
        for (int k = 0; k < 32; ++k) {
            row[k] = camelid_rows4_quant(block, lane, k);
        }
    }
    for (size_t m = m_rows; m < 16; ++m) {
        a_scales[m] = 0.0f;
    }
}

__attribute__((target("avx512f,amx-tile,amx-int8")))
void camelid_q8_0_amx_compute_tile16(
    const camelid_q8_rows4_block_t * input_groups,
    size_t blocks_per_row,
    size_t m_rows,
    const camelid_q8_amx_block_t * weight_blocks,
    float * output,
    size_t output_stride
) {
    if (!camelid_x86_q8_amx_prepare_thread()) {
        return;
    }

    __attribute__((aligned(64))) int8_t a_tile[16 * 32];
    __attribute__((aligned(64))) int32_t c_tile[16 * 16];
    __attribute__((aligned(64))) float a_scales[16];

    for (size_t kb = 0; kb < blocks_per_row; ++kb) {
        const camelid_q8_amx_block_t * wb = weight_blocks + kb;
        camelid_pack_a_tile(input_groups, blocks_per_row, kb, m_rows, a_tile, a_scales);

        _tile_zero(4);
        _tile_loadd(2, a_tile, 32);
        _tile_loadd(0, wb->quants, 64);
        _tile_dpbssd(4, 2, 0);
        _tile_stored(4, c_tile, 64);

        const __m512 b_scales = _mm512_loadu_ps(wb->scales);
        for (size_t m = 0; m < m_rows; ++m) {
            const __m512 ints = _mm512_cvtepi32_ps(_mm512_loadu_si512((const void *)(c_tile + m * 16)));
            const __m512 scale = _mm512_mul_ps(b_scales, _mm512_set1_ps(a_scales[m]));
            const __m512 prev = _mm512_loadu_ps(output + m * output_stride);
            const __m512 next = _mm512_fmadd_ps(ints, scale, prev);
            _mm512_storeu_ps(output + m * output_stride, next);
        }
    }
}

void camelid_x86_q8_amx_release_thread(void) {
    if (camelid_amx_state == 2) {
        _tile_release();
        camelid_amx_state = 0;
    }
}
#else
#include <stddef.h>
#include <stdint.h>
int camelid_x86_q8_amx_supported(void) { return 0; }
int camelid_x86_q8_amx_prepare_thread(void) { return 0; }
void camelid_x86_q8_amx_release_thread(void) {}
void camelid_q8_0_amx_compute_tile16(const void * input_groups, size_t blocks_per_row, size_t m_rows, const void * weight_blocks, float * output, size_t output_stride) {
    (void)input_groups; (void)blocks_per_row; (void)m_rows; (void)weight_blocks; (void)output; (void)output_stride;
}
#endif
