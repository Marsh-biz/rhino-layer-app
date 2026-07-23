# Inspect Branch object types in a LIVE (authoring) Branch model, to design the
# object-type catalog's matching key. Run either:
#   - via the Rhino MCP `run_python` tool (it injects __rhino_doc__), or
#   - pasted into the Rhino 8 ScriptEditor (Python 3) with the model open.
#
# It reports, for every live Branch object, the signature that could map it to a
# layer: (class, material/species, TypePrefix) -> actual layer, with counts.
# Nothing is modified.
import json, collections

try:
    doc = __rhino_doc__            # injected by the MCP script editor
except NameError:
    import Rhino
    doc = Rhino.RhinoDoc.ActiveDoc  # ScriptEditor fallback


def get_branch_doc():
    try:
        from sc.om.Document import BranchDoc
    except Exception as e:
        return None, "sc.om not importable: %s" % e
    try:
        bdoc = BranchDoc.ActiveDocument
    except Exception as e:
        return None, "BranchDoc.ActiveDocument threw: %s" % e
    return bdoc, None


def prop(o, name, default=None):
    try:
        return getattr(o, name)
    except Exception:
        return default


def s(v):
    return "" if v is None else str(v)


def material_fields(o):
    m = prop(o, "Material")
    if m is None:
        return ("", "", "")
    if isinstance(m, str):
        return (m, "", "")
    return (s(prop(m, "Name")), s(prop(m, "Species")), s(prop(m, "MatProduct")))


def layer_of(host, o):
    hid = prop(o, "HostId")
    if hid is None:
        return ""
    try:
        ho = host.Objects.FindId(hid)
        return host.Layers[ho.Attributes.LayerIndex].FullPath
    except Exception:
        return ""


bdoc, err = get_branch_doc()
if bdoc is None:
    print(json.dumps({
        "mode": "no_live_branch",
        "note": "No live Branch session (baked model, or Branch not loaded). "
                "Open the AUTHORING model. Detail: %s" % err,
    }, indent=2))
else:
    host = bdoc.HostDoc
    rows = []
    try:
        allobjs = list(bdoc.Objects.AllObjects)
    except Exception as e:
        allobjs = []
        print("AllObjects failed:", e)

    for o in allobjs:
        try:
            cls = o.GetType().Name
        except Exception:
            cls = "<unknown>"
        matname, species, product = material_fields(o)
        rows.append({
            "class": cls,
            "typePrefix": s(prop(o, "TypePrefix")),
            "typeSuffix": s(prop(o, "TypeSuffix")),
            "material": matname,
            "species": species,
            "product": product,
            "layer": layer_of(host, o),
            "name": s(prop(o, "Name")),
        })

    # Aggregate the candidate signature -> layer, so we can see what discriminates layers.
    agg = collections.Counter()
    for r in rows:
        sig = (r["class"], r["species"] or r["material"] or "", r["typePrefix"], r["layer"])
        agg[sig] += 1
    signatures = [
        {"class": k[0], "materialOrSpecies": k[1], "typePrefix": k[2], "layer": k[3], "count": v}
        for k, v in sorted(agg.items(), key=lambda kv: (kv[0][3], kv[0][0]))
    ]

    classes = sorted({r["class"] for r in rows})
    # Which layers hold more than one distinct class? (informs whether one type per layer holds.)
    layer_classes = collections.defaultdict(set)
    for r in rows:
        layer_classes[r["layer"]].add(r["class"])
    multi = {L: sorted(cs) for L, cs in layer_classes.items() if len(cs) > 1}

    print(json.dumps({
        "mode": "authoring",
        "total_objects": len(rows),
        "distinct_classes": classes,
        "layers_with_multiple_classes": multi,
        "signatures": signatures,
    }, indent=2))
