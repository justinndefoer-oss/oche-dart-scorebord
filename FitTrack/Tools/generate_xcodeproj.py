#!/usr/bin/env python3
"""Generate FitTrack.xcodeproj from the source tree.

The project file is a plain list of every .swift file plus the asset catalog,
so it opens in any recent Xcode (no Xcode-16-only synchronised folder groups).

You normally do NOT need this: once the project is open, adding files in Xcode
updates the project file itself. Re-run it only if you add files from outside
Xcode (say, by copying a folder in) and want them picked up:

    python3 Tools/generate_xcodeproj.py

Run it from the FitTrack directory (the one containing FitTrack.xcodeproj).
"""

from __future__ import annotations

import hashlib
import os
import sys

PROJECT_NAME = "FitTrack"
SOURCE_DIR = "FitTrack"          # folder holding the app's sources
BUNDLE_ID = "com.example.FitTrack"
DEPLOYMENT_TARGET = "17.0"
SWIFT_VERSION = "5.0"

# Files/folders never included in the project.
IGNORED = {".DS_Store", "__pycache__"}


def oid(*parts: str) -> str:
    """Deterministic 24-hex-character object id, the shape Xcode expects."""
    digest = hashlib.md5("::".join(parts).encode("utf-8")).hexdigest()
    return digest[:24].upper()


class Node:
    """A folder in the source tree, mirrored as a PBXGroup."""

    def __init__(self, name: str, path: str):
        self.name = name
        self.path = path            # path relative to the project root
        self.files: list[str] = []  # file names inside this folder
        self.children: list[Node] = []

    @property
    def group_id(self) -> str:
        return oid("group", self.path)


def scan(path: str, name: str) -> Node:
    node = Node(name, path)
    for entry in sorted(os.listdir(path)):
        if entry in IGNORED:
            continue
        full = os.path.join(path, entry)
        if entry.endswith(".xcassets"):
            node.files.append(entry)
        elif os.path.isdir(full):
            node.children.append(scan(full, entry))
        elif entry.endswith(".swift"):
            node.files.append(entry)
    return node


def collect_swift(node: Node, acc: list[tuple[str, str]]) -> None:
    """(relative path, file name) for every Swift file, depth first."""
    for file_name in node.files:
        if file_name.endswith(".swift"):
            acc.append((os.path.join(node.path, file_name), file_name))
    for child in node.children:
        collect_swift(child, acc)


def collect_resources(node: Node, acc: list[tuple[str, str]]) -> None:
    for file_name in node.files:
        if file_name.endswith(".xcassets"):
            acc.append((os.path.join(node.path, file_name), file_name))
    for child in node.children:
        collect_resources(child, acc)


def file_type(name: str) -> str:
    if name.endswith(".swift"):
        return "sourcecode.swift"
    if name.endswith(".xcassets"):
        return "folder.assetcatalog"
    return "text"


def emit_groups(node: Node, lines: list[str]) -> None:
    children = []
    for file_name in node.files:
        children.append(
            f"\t\t\t\t{oid('file', os.path.join(node.path, file_name))} /* {file_name} */,"
        )
    for child in node.children:
        children.append(f"\t\t\t\t{child.group_id} /* {child.name} */,")

    lines.append(f"\t\t{node.group_id} /* {node.name} */ = {{")
    lines.append("\t\t\tisa = PBXGroup;")
    lines.append("\t\t\tchildren = (")
    lines.extend(children)
    lines.append("\t\t\t);")
    lines.append(f"\t\t\tpath = {node.name};")
    lines.append('\t\t\tsourceTree = "<group>";')
    lines.append("\t\t};")

    for child in node.children:
        emit_groups(child, lines)


def build() -> str:
    if not os.path.isdir(SOURCE_DIR):
        sys.exit(f"error: run this from the folder containing '{SOURCE_DIR}/'")

    tree = scan(SOURCE_DIR, SOURCE_DIR)

    swift_files: list[tuple[str, str]] = []
    collect_swift(tree, swift_files)
    resources: list[tuple[str, str]] = []
    collect_resources(tree, resources)

    project_id = oid("project")
    target_id = oid("target")
    product_id = oid("product")
    products_group_id = oid("group", "Products")
    root_group_id = oid("group", "")
    sources_phase_id = oid("phase", "sources")
    frameworks_phase_id = oid("phase", "frameworks")
    resources_phase_id = oid("phase", "resources")
    project_config_list_id = oid("configlist", "project")
    target_config_list_id = oid("configlist", "target")

    lines: list[str] = []
    add = lines.append

    add("// !$*UTF8*$!")
    add("{")
    add("\tarchiveVersion = 1;")
    add("\tclasses = {")
    add("\t};")
    add("\tobjectVersion = 56;")
    add("\tobjects = {")
    add("")

    # --- PBXBuildFile -------------------------------------------------------
    add("/* Begin PBXBuildFile section */")
    for rel, name in swift_files:
        add(
            f"\t\t{oid('build', rel)} /* {name} in Sources */ = "
            f"{{isa = PBXBuildFile; fileRef = {oid('file', rel)} /* {name} */; }};"
        )
    for rel, name in resources:
        add(
            f"\t\t{oid('build', rel)} /* {name} in Resources */ = "
            f"{{isa = PBXBuildFile; fileRef = {oid('file', rel)} /* {name} */; }};"
        )
    add("/* End PBXBuildFile section */")
    add("")

    # --- PBXFileReference ---------------------------------------------------
    add("/* Begin PBXFileReference section */")
    add(
        f"\t\t{product_id} /* {PROJECT_NAME}.app */ = {{isa = PBXFileReference; "
        f"explicitFileType = wrapper.application; includeInIndex = 0; "
        f"path = {PROJECT_NAME}.app; sourceTree = BUILT_PRODUCTS_DIR; }};"
    )
    for rel, name in swift_files + resources:
        add(
            f"\t\t{oid('file', rel)} /* {name} */ = {{isa = PBXFileReference; "
            f"lastKnownFileType = {file_type(name)}; path = {name}; "
            f'sourceTree = "<group>"; }};'
        )
    add("/* End PBXFileReference section */")
    add("")

    # --- PBXFrameworksBuildPhase -------------------------------------------
    add("/* Begin PBXFrameworksBuildPhase section */")
    add(f"\t\t{frameworks_phase_id} /* Frameworks */ = {{")
    add("\t\t\tisa = PBXFrameworksBuildPhase;")
    add("\t\t\tbuildActionMask = 2147483647;")
    add("\t\t\tfiles = (")
    add("\t\t\t);")
    add("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    add("\t\t};")
    add("/* End PBXFrameworksBuildPhase section */")
    add("")

    # --- PBXGroup -----------------------------------------------------------
    add("/* Begin PBXGroup section */")
    add(f"\t\t{root_group_id} = {{")
    add("\t\t\tisa = PBXGroup;")
    add("\t\t\tchildren = (")
    add(f"\t\t\t\t{tree.group_id} /* {PROJECT_NAME} */,")
    add(f"\t\t\t\t{products_group_id} /* Products */,")
    add("\t\t\t);")
    add('\t\t\tsourceTree = "<group>";')
    add("\t\t};")
    add(f"\t\t{products_group_id} /* Products */ = {{")
    add("\t\t\tisa = PBXGroup;")
    add("\t\t\tchildren = (")
    add(f"\t\t\t\t{product_id} /* {PROJECT_NAME}.app */,")
    add("\t\t\t);")
    add("\t\t\tname = Products;")
    add('\t\t\tsourceTree = "<group>";')
    add("\t\t};")
    emit_groups(tree, lines)
    add("/* End PBXGroup section */")
    add("")

    # --- PBXNativeTarget ----------------------------------------------------
    add("/* Begin PBXNativeTarget section */")
    add(f"\t\t{target_id} /* {PROJECT_NAME} */ = {{")
    add("\t\t\tisa = PBXNativeTarget;")
    add(
        f"\t\t\tbuildConfigurationList = {target_config_list_id} "
        f'/* Build configuration list for PBXNativeTarget "{PROJECT_NAME}" */;'
    )
    add("\t\t\tbuildPhases = (")
    add(f"\t\t\t\t{sources_phase_id} /* Sources */,")
    add(f"\t\t\t\t{frameworks_phase_id} /* Frameworks */,")
    add(f"\t\t\t\t{resources_phase_id} /* Resources */,")
    add("\t\t\t);")
    add("\t\t\tbuildRules = (")
    add("\t\t\t);")
    add("\t\t\tdependencies = (")
    add("\t\t\t);")
    add(f"\t\t\tname = {PROJECT_NAME};")
    add(f"\t\t\tproductName = {PROJECT_NAME};")
    add(f"\t\t\tproductReference = {product_id} /* {PROJECT_NAME}.app */;")
    add('\t\t\tproductType = "com.apple.product-type.application";')
    add("\t\t};")
    add("/* End PBXNativeTarget section */")
    add("")

    # --- PBXProject ---------------------------------------------------------
    add("/* Begin PBXProject section */")
    add(f"\t\t{project_id} /* Project object */ = {{")
    add("\t\t\tisa = PBXProject;")
    add("\t\t\tattributes = {")
    add("\t\t\t\tBuildIndependentTargetsInParallel = 1;")
    add("\t\t\t\tLastSwiftUpdateCheck = 1500;")
    add("\t\t\t\tLastUpgradeCheck = 1500;")
    add("\t\t\t\tTargetAttributes = {")
    add(f"\t\t\t\t\t{target_id} = {{")
    add("\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;")
    add("\t\t\t\t\t};")
    add("\t\t\t\t};")
    add("\t\t\t};")
    add(
        f"\t\t\tbuildConfigurationList = {project_config_list_id} "
        f'/* Build configuration list for PBXProject "{PROJECT_NAME}" */;'
    )
    add('\t\t\tcompatibilityVersion = "Xcode 14.0";')
    add("\t\t\tdevelopmentRegion = en;")
    add("\t\t\thasScannedForEncodings = 0;")
    add("\t\t\tknownRegions = (")
    add("\t\t\t\ten,")
    add("\t\t\t\tBase,")
    add("\t\t\t);")
    add(f"\t\t\tmainGroup = {root_group_id};")
    add(f"\t\t\tproductRefGroup = {products_group_id} /* Products */;")
    add('\t\t\tprojectDirPath = "";')
    add('\t\t\tprojectRoot = "";')
    add("\t\t\ttargets = (")
    add(f"\t\t\t\t{target_id} /* {PROJECT_NAME} */,")
    add("\t\t\t);")
    add("\t\t};")
    add("/* End PBXProject section */")
    add("")

    # --- PBXResourcesBuildPhase --------------------------------------------
    add("/* Begin PBXResourcesBuildPhase section */")
    add(f"\t\t{resources_phase_id} /* Resources */ = {{")
    add("\t\t\tisa = PBXResourcesBuildPhase;")
    add("\t\t\tbuildActionMask = 2147483647;")
    add("\t\t\tfiles = (")
    for rel, name in resources:
        add(f"\t\t\t\t{oid('build', rel)} /* {name} in Resources */,")
    add("\t\t\t);")
    add("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    add("\t\t};")
    add("/* End PBXResourcesBuildPhase section */")
    add("")

    # --- PBXSourcesBuildPhase ----------------------------------------------
    add("/* Begin PBXSourcesBuildPhase section */")
    add(f"\t\t{sources_phase_id} /* Sources */ = {{")
    add("\t\t\tisa = PBXSourcesBuildPhase;")
    add("\t\t\tbuildActionMask = 2147483647;")
    add("\t\t\tfiles = (")
    for rel, name in swift_files:
        add(f"\t\t\t\t{oid('build', rel)} /* {name} in Sources */,")
    add("\t\t\t);")
    add("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    add("\t\t};")
    add("/* End PBXSourcesBuildPhase section */")
    add("")

    # --- XCBuildConfiguration ----------------------------------------------
    project_common = [
        "ALWAYS_SEARCH_USER_PATHS = NO",
        "ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES",
        "CLANG_ANALYZER_NONNULL = YES",
        "CLANG_ENABLE_MODULES = YES",
        "CLANG_ENABLE_OBJC_ARC = YES",
        "CLANG_WARN_DOCUMENTATION_COMMENTS = YES",
        "CLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE",
        "COPY_PHASE_STRIP = NO",
        "ENABLE_STRICT_OBJC_MSGSEND = YES",
        "ENABLE_USER_SCRIPT_SANDBOXING = YES",
        "GCC_C_LANGUAGE_STANDARD = gnu17",
        "GCC_NO_COMMON_BLOCKS = YES",
        "GCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR",
        "GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE",
        "GCC_WARN_UNUSED_VARIABLE = YES",
        f"IPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET}",
        "LOCALIZATION_PREFERS_STRING_CATALOGS = YES",
        "MTL_FAST_MATH = YES",
        "SDKROOT = iphoneos",
        "SWIFT_EMIT_LOC_STRINGS = YES",
    ]
    project_debug = project_common + [
        "DEBUG_INFORMATION_FORMAT = dwarf",
        "ENABLE_TESTABILITY = YES",
        "GCC_DYNAMIC_NO_PIC = NO",
        "GCC_OPTIMIZATION_LEVEL = 0",
        'GCC_PREPROCESSOR_DEFINITIONS = (\n\t\t\t\t\t"DEBUG=1",\n\t\t\t\t\t"$(inherited)",\n\t\t\t\t)',
        "MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE",
        "ONLY_ACTIVE_ARCH = YES",
        "SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG",
        'SWIFT_OPTIMIZATION_LEVEL = "-Onone"',
    ]
    project_release = project_common + [
        'DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym"',
        "ENABLE_NS_ASSERTIONS = NO",
        "MTL_ENABLE_DEBUG_INFO = NO",
        "SWIFT_COMPILATION_MODE = wholemodule",
        "VALIDATE_PRODUCT = YES",
    ]

    target_common = [
        "ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon",
        "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor",
        "CODE_SIGN_STYLE = Automatic",
        "CURRENT_PROJECT_VERSION = 1",
        "ENABLE_PREVIEWS = YES",
        "GENERATE_INFOPLIST_FILE = YES",
        "INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES",
        "INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES",
        "INFOPLIST_KEY_UILaunchScreen_Generation = YES",
        'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait '
        'UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft '
        'UIInterfaceOrientationLandscapeRight"',
        'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait"',
        'LD_RUNPATH_SEARCH_PATHS = (\n\t\t\t\t\t"$(inherited)",\n\t\t\t\t\t"@executable_path/Frameworks",\n\t\t\t\t)',
        "MARKETING_VERSION = 1.0",
        f"PRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID}",
        'PRODUCT_NAME = "$(TARGET_NAME)"',
        "SWIFT_EMIT_LOC_STRINGS = YES",
        f"SWIFT_VERSION = {SWIFT_VERSION}",
        'TARGETED_DEVICE_FAMILY = "1,2"',
    ]

    def config_block(config_id: str, name: str, settings: list[str]) -> None:
        add(f"\t\t{config_id} /* {name} */ = {{")
        add("\t\t\tisa = XCBuildConfiguration;")
        add("\t\t\tbuildSettings = {")
        for setting in settings:
            add(f"\t\t\t\t{setting};")
        add("\t\t\t};")
        add(f"\t\t\tname = {name};")
        add("\t\t};")

    project_debug_id = oid("config", "project", "Debug")
    project_release_id = oid("config", "project", "Release")
    target_debug_id = oid("config", "target", "Debug")
    target_release_id = oid("config", "target", "Release")

    add("/* Begin XCBuildConfiguration section */")
    config_block(project_debug_id, "Debug", project_debug)
    config_block(project_release_id, "Release", project_release)
    config_block(target_debug_id, "Debug", target_common)
    config_block(target_release_id, "Release", target_common)
    add("/* End XCBuildConfiguration section */")
    add("")

    # --- XCConfigurationList ------------------------------------------------
    add("/* Begin XCConfigurationList section */")
    for list_id, kind, debug_id, release_id in (
        (project_config_list_id, "PBXProject", project_debug_id, project_release_id),
        (target_config_list_id, "PBXNativeTarget", target_debug_id, target_release_id),
    ):
        add(
            f"\t\t{list_id} /* Build configuration list for {kind} "
            f'"{PROJECT_NAME}" */ = {{'
        )
        add("\t\t\tisa = XCConfigurationList;")
        add("\t\t\tbuildConfigurations = (")
        add(f"\t\t\t\t{debug_id} /* Debug */,")
        add(f"\t\t\t\t{release_id} /* Release */,")
        add("\t\t\t);")
        add("\t\t\tdefaultConfigurationIsVisible = 0;")
        add("\t\t\tdefaultConfigurationName = Release;")
        add("\t\t};")
    add("/* End XCConfigurationList section */")
    add("\t};")
    add(f"\trootObject = {project_id} /* Project object */;")
    add("}")
    add("")

    return "\n".join(lines)


SCHEME = """<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1500"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{target_id}"
               BuildableName = "{name}.app"
               BlueprintName = "{name}"
               ReferencedContainer = "container:{name}.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{target_id}"
            BuildableName = "{name}.app"
            BlueprintName = "{name}"
            ReferencedContainer = "container:{name}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{target_id}"
            BuildableName = "{name}.app"
            BlueprintName = "{name}"
            ReferencedContainer = "container:{name}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
"""

WORKSPACE = """<?xml version="1.0" encoding="UTF-8"?>
<Workspace
   version = "1.0">
   <FileRef
      location = "self:">
   </FileRef>
</Workspace>
"""


def main() -> None:
    project_dir = f"{PROJECT_NAME}.xcodeproj"
    os.makedirs(os.path.join(project_dir, "project.xcworkspace"), exist_ok=True)
    os.makedirs(os.path.join(project_dir, "xcshareddata", "xcschemes"), exist_ok=True)

    with open(os.path.join(project_dir, "project.pbxproj"), "w", encoding="utf-8") as handle:
        handle.write(build())

    with open(
        os.path.join(project_dir, "project.xcworkspace", "contents.xcworkspacedata"),
        "w",
        encoding="utf-8",
    ) as handle:
        handle.write(WORKSPACE)

    with open(
        os.path.join(project_dir, "xcshareddata", "xcschemes", f"{PROJECT_NAME}.xcscheme"),
        "w",
        encoding="utf-8",
    ) as handle:
        handle.write(SCHEME.format(target_id=oid("target"), name=PROJECT_NAME))

    print(f"wrote {project_dir}")


if __name__ == "__main__":
    main()
