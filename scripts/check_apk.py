"""Checks a built Connect APK for the problems that stop it installing or
updating on some Android phones, before it is uploaded in admin.

    python -I scripts/check_apk.py Connect.apk [--previous OLD.apk]

--previous compares signing certificates with the APK users already have:
a different certificate means the auto-update fails and users must uninstall.

Needs the Android SDK build-tools (aapt2, apksigner, zipalign); finds them
through ANDROID_HOME / ANDROID_SDK_ROOT or the default SDK folder.
"""

import argparse
import os
import re
import struct
import subprocess
import sys
import zipfile

# ABIs real phones and emulators use; a missing one fails to install on
# those devices with INSTALL_FAILED_NO_MATCHING_ABIS.
EXPECTED_ABIS = ["arm64-v8a", "armeabi-v7a", "x86_64", "x86"]
# 64-bit libraries must be 16 KB aligned for 16 KB page-size phones
# (Android 15+); 32-bit ABIs only run with 4 KB pages.
ABIS_NEEDING_16K = {"arm64-v8a", "x86_64"}
PAGE_16K = 16384
# Lowest Android the app may require; React Native needs 24 (Android 7.0).
MAX_MIN_SDK = 24

problems = []
warnings = []


def fail(msg):
    problems.append(msg)
    print("  FAIL  " + msg)


def warn(msg):
    warnings.append(msg)
    print("  WARN  " + msg)


def ok(msg):
    print("  ok    " + msg)


def find_build_tools():
    roots = [os.environ.get("ANDROID_HOME"), os.environ.get("ANDROID_SDK_ROOT")]
    if os.name == "nt":
        roots.append(os.path.join(os.environ.get("LOCALAPPDATA", ""), "Android", "Sdk"))
    else:
        roots += [os.path.expanduser("~/Android/Sdk"), os.path.expanduser("~/Library/Android/sdk")]
    for root in filter(None, roots):
        bt = os.path.join(root, "build-tools")
        if not os.path.isdir(bt):
            continue
        versions = sorted(
            os.listdir(bt),
            key=lambda v: [int(p) if p.isdigit() else 0 for p in re.split(r"[.-]", v)],
        )
        if versions:
            return os.path.join(bt, versions[-1])
    return None


def tool(build_tools, name):
    if os.name == "nt":
        for ext in (".exe", ".bat"):
            path = os.path.join(build_tools, name + ext)
            if os.path.exists(path):
                return path
    path = os.path.join(build_tools, name)
    return path if os.path.exists(path) else None


def run(cmd):
    res = subprocess.run(cmd, capture_output=True, text=True, shell=False)
    return res.returncode, (res.stdout or "") + (res.stderr or "")


def load_alignments(data):
    """p_align of each PT_LOAD segment of an ELF shared library."""
    if data[:4] != b"\x7fELF":
        return None
    is64 = data[4] == 2
    endian = "<" if data[5] == 1 else ">"
    if is64:
        phoff = struct.unpack_from(endian + "Q", data, 0x20)[0]
        phentsize, phnum = struct.unpack_from(endian + "HH", data, 0x36)
    else:
        phoff = struct.unpack_from(endian + "I", data, 0x1C)[0]
        phentsize, phnum = struct.unpack_from(endian + "HH", data, 0x2A)
    aligns = []
    for i in range(phnum):
        off = phoff + i * phentsize
        p_type = struct.unpack_from(endian + "I", data, off)[0]
        if p_type != 1:  # PT_LOAD
            continue
        if is64:
            p_align = struct.unpack_from(endian + "Q", data, off + 0x30)[0]
        else:
            p_align = struct.unpack_from(endian + "I", data, off + 0x1C)[0]
        aligns.append(p_align)
    return aligns


def check_badging(aapt2, apk):
    print("\nManifest")
    code, out = run([aapt2, "dump", "badging", apk])
    if code != 0:
        fail("aapt2 could not read the APK (damaged or not an APK): " + out.strip()[:300])
        return
    pkg = re.search(r"package: name='([^']+)' versionCode='([^']*)' versionName='([^']*)'", out)
    if pkg:
        ok("package %s, version %s (build %s)" % (pkg.group(1), pkg.group(3), pkg.group(2)))
    min_sdk = re.search(r"(?:minSdkVersion|sdkVersion):'(\d+)'", out)
    if min_sdk:
        value = int(min_sdk.group(1))
        if value > MAX_MIN_SDK:
            fail("minSdk %d: phones older than API %d cannot install it" % (value, value))
        else:
            ok("minSdk %d (Android 7.0+)" % value)
    target = re.search(r"targetSdkVersion:'(\d+)'", out)
    if target:
        value = int(target.group(1))
        if value < 24:
            fail("targetSdk %d: Android 14+ blocks installing apps that target below API 24" % value)
        else:
            ok("targetSdk %d" % value)
    if "testOnly" in out or "application-debuggable" in out:
        fail("debuggable/testOnly build: many phones refuse it or it is slow; upload a release build")
    native = re.search(r"native-code: (.*)", out)
    abis = re.findall(r"'([^']+)'", native.group(1)) if native else []
    missing = [a for a in EXPECTED_ABIS if a not in abis]
    if not abis:
        warn("no native code listed")
    elif missing:
        fail("missing ABIs %s: those devices get INSTALL_FAILED_NO_MATCHING_ABIS" % ", ".join(missing))
    else:
        ok("native code for " + ", ".join(abis))


def check_signature(apksigner, apk, previous):
    print("\nSigning")
    code, out = run([apksigner, "verify", "--verbose", "--print-certs", apk])
    if code != 0:
        fail("signature does not verify (phones say 'App not installed'): " + out.strip()[:300])
        return
    schemes = re.findall(r"Verified using (v[\d.]+) scheme.*: true", out)
    ok("signed with scheme " + ", ".join(schemes))
    cert = re.search(r"certificate SHA-256 digest: ([0-9a-f]+)", out)
    if cert:
        ok("certificate SHA-256 " + cert.group(1))
        if re.search(r"CN=Android Debug", out):
            fail("signed with the Android debug key: it cannot update the released app")
    if previous:
        _, prev_out = run([apksigner, "verify", "--print-certs", previous])
        prev = re.search(r"certificate SHA-256 digest: ([0-9a-f]+)", prev_out)
        if not prev or not cert:
            warn("could not read the certificate of " + previous)
        elif prev.group(1) != cert.group(1):
            fail(
                "certificate differs from %s: auto-update and in-place install fail "
                "(INSTALL_FAILED_UPDATE_INCOMPATIBLE); users must uninstall first" % previous
            )
        else:
            ok("same certificate as " + previous + " (updates install in place)")


def check_native_libs(zipalign, apk):
    print("\n16 KB page size (Android 15+ phones)")
    bad = []
    with zipfile.ZipFile(apk) as z:
        for info in z.infolist():
            m = re.match(r"lib/([^/]+)/(.+\.so)$", info.filename)
            if not m or m.group(1) not in ABIS_NEEDING_16K:
                continue
            aligns = load_alignments(z.read(info))
            if aligns is None:
                warn(info.filename + " is not an ELF library")
            elif min(aligns or [PAGE_16K]) < PAGE_16K:
                bad.append("%s (align %d)" % (info.filename, min(aligns)))
    if bad:
        warn(
            "%d 64-bit libraries are not 16 KB aligned; on 16 KB phones Android "
            "runs the app in compatibility mode or shows a warning:\n        %s"
            % (len(bad), "\n        ".join(bad))
        )
    else:
        ok("all 64-bit native libraries are 16 KB aligned")
    if zipalign:
        code, out = run([zipalign, "-c", "-P", "16", "4", apk])
        if code != 0:
            warn("zipalign -P 16 check failed (uncompressed libraries not 16 KB aligned in the zip)")
        else:
            ok("zip entries aligned")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("apk")
    parser.add_argument("--previous", help="APK users have now, to compare signing certificates")
    args = parser.parse_args()

    if not os.path.isfile(args.apk):
        sys.exit("No such file: " + args.apk)
    build_tools = find_build_tools()
    if not build_tools:
        sys.exit("Android SDK build-tools not found; set ANDROID_HOME")
    aapt2 = tool(build_tools, "aapt2")
    apksigner = tool(build_tools, "apksigner")
    zipalign = tool(build_tools, "zipalign")
    print("Checking %s (build-tools %s)" % (args.apk, os.path.basename(build_tools)))

    size_mb = os.path.getsize(args.apk) / (1024 * 1024)
    print("\nFile")
    ok("%.1f MB" % size_mb)

    if aapt2:
        check_badging(aapt2, args.apk)
    else:
        warn("aapt2 not found, skipped the manifest checks")
    if apksigner:
        check_signature(apksigner, args.apk, args.previous)
    else:
        warn("apksigner not found, skipped the signing checks")
    check_native_libs(zipalign, args.apk)

    print("\n%d problem(s), %d warning(s)" % (len(problems), len(warnings)))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
