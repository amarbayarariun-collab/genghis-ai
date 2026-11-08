// Painterly shading: shadowed areas are tinted toward a cool violet "ink" instead of
// simply going dark, and lit faces get a warm lift. Idea inspired by verdant's
// art-directed shadow tint; this is an original implementation for our warm steppe palette.
export function paintMaterial(material, { ground = false, key = 'p' } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      .replace('#include <opaque_fragment>', `
        float pShadow = 1.0 - getShadowMask();
        vec3 pInk = ${ground ? 'vec3(0.36,0.27,0.34)' : 'vec3(0.30,0.24,0.33)'} * (0.8 + diffuseColor.rgb * 0.4);
        outgoingLight = mix(outgoingLight, pInk * length(diffuseColor.rgb) * 0.75, pShadow * ${ground ? '0.55' : '0.45'});
        outgoingLight *= mix(vec3(1.0), vec3(1.06, 1.02, 0.95), 1.0 - pShadow);
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'painterly-' + key + (ground ? '-g' : '-o');
  material.needsUpdate = true;
  return material;
}
