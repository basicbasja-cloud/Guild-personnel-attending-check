import json
import os
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "guild_members.json")


def load_members():
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_members(members):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(members, f, ensure_ascii=False, indent=2)


@app.route("/")
def index():
    members = load_members()
    confirmed_count = sum(1 for m in members if m["confirmed"])
    return render_template(
        "index.html",
        members=members,
        total=len(members),
        confirmed=confirmed_count,
    )


@app.route("/api/members", methods=["GET"])
def get_members():
    return jsonify(load_members())


@app.route("/api/members/<int:member_index>/confirm", methods=["POST"])
def confirm_member(member_index):
    members = load_members()
    if member_index < 0 or member_index >= len(members):
        return jsonify({"error": "Member not found"}), 404
    data = request.get_json(silent=True) or {}
    confirmed = data.get("confirmed", True)
    members[member_index]["confirmed"] = bool(confirmed)
    save_members(members)
    return jsonify(members[member_index])


@app.route("/api/reset", methods=["POST"])
def reset_attendance():
    members = load_members()
    for m in members:
        m["confirmed"] = False
    save_members(members)
    return jsonify({"message": "Attendance reset", "total": len(members)})


if __name__ == "__main__":
    app.run()
