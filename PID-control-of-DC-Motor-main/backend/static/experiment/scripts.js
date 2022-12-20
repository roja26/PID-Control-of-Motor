setTimeout(() => {
    location.href = '../../logout'
}, parseInt(localStorage.getItem("timeLeft")) * 1000);

function updateTime() {
    timeLeft = parseInt(localStorage.getItem("timeLeft"))
    if (!isNaN(timeLeft)) {
        if (timeLeft < 0)
            window.location.href = "../../logout"
        timeLeft--
        let min = Math.floor(timeLeft / 60), sec = timeLeft % 60;
        if (sec < 10)
            sec = "0" + sec
        if (min < 10)
            min = "0" + min
        document.getElementById("time-left").innerHTML = `${min}:${sec}`
        localStorage.setItem("timeLeft", timeLeft)
    } else {
        localStorage.setItem("timeLeft", "900")
        document.getElementById("time-left").innerHTML = `15:00`
    }
}

updateTime()
setInterval(updateTime, 1000);
if(localStorage.getItem("submit-disabled") == 1){
    document.getElementsByClassName("submit-form")[0].disabled = true
}

$('.input').keypress(function (e) {
    if (e.which == 13) {
        e.preventDefault();
    }
});

function bind_to_slider(slider, input, min, max, from, step) {
    let $range = $(slider);
    let $input = $(input);

    $range.ionRangeSlider({
        skin: "round",
        min: min,
        max: max,
        from: from,
        step: step,
        onStart: (data) => {
            $input.prop("value", data.from);
        },
        onChange: (data) => {
            $input.prop("value", data.from);
        }
    });

    let instance = $range.data("ionRangeSlider");

    $input.on("input", function () {
        var val = $(this).prop("value");
        if (val < min) {
            val = min;
        } else if (val > max) {
            val = max;
        }

        instance.update({
            from: val
        });
    });
}

bind_to_slider(".kp-slider", ".kp-input", -100, 100, 0, 0, 0.1);
bind_to_slider(".ki-slider", ".ki-input", -100, 100, 0, 0, 0.1);
bind_to_slider(".kd-slider", ".kd-input", -100, 100, 0, 0, 0.1);
bind_to_slider(".angle-slider", ".angle-input", 0, 360, 180, 1);
$(".form").submit(function (e) {
    e.preventDefault();
});

Number.prototype.padLeft = function (base, chr) {
    let len = (String(base || 10).length - String(this).length) + 1;
    return len > 0 ? new Array(len).join(chr || '0') + this : this;
}

function getFormattedDate() {
    let d = new Date
    let dformat = [d.getFullYear(), (d.getMonth() + 1).padLeft(), d.getDate().padLeft(),].join('-') + ' ' +
        [d.getHours().padLeft(), d.getMinutes().padLeft(), d.getSeconds().padLeft()].join(':');
    return dformat
}

let time = getFormattedDate()

function startSim() {
    time = getFormattedDate()
    let kp = $(".kp-input").val();
    let ki = $(".ki-input").val();
    let kd = $(".kd-input").val();
    let angle = $(".angle-input").val();

    let submit = document.getElementsByClassName("submit-form")[0]
    submit.disabled = true
    localStorage.setItem("submit-disabled",1)
    makeGraph()
    let interval = setInterval(updateGraph, 1000);
    setTimeout(() => {
        localStorage.setItem("submit-disabled",0)
        submit.disabled = false
        clearInterval(interval)
    }, 17000);

    fetch('../../../mqtt', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kp: kp, ki: ki, kd: kd, angle: angle }),
    }).then((response) => response.json())
        .then((data) => {
            console.log('Success:', data);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

function resetExperiment() {
    fetch('../../../mqtt', {
        method: 'POST', // or 'PUT'
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kp: -1, ki: -1, kd: -1, angle: -1 }),
    }).then((response) => response.json())
        .then((data) => {
            console.log('Success:', data);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

let graph;

function makeGraph() {
    fetch(`https://api.thingspeak.com/channels/1922377/fields/1.json?start=${time}`)
        .then((response) => response.json())
        .then((data) => {
            data = data.feeds.filter(x => x.field1)
            graph = new Chart(document.getElementById('graph'), {
                type: 'line',
                data: {
                    labels: [...data.keys()].forEach(key => key+1),
                    datasets: [
                        {
                            label: 'Angle per 100 miliseconds',
                            data: data.map(row => row.field1),
                            tension: 0.1
                        }
                    ]
                }
            });
            time = getFormattedDate()
        })
        .catch((error) => {
            console.log('Error: ', error)
        })
}

function updateGraph() {
    fetch(`https://api.thingspeak.com/channels/1922377/fields/1.json?start=${time}`)
        .then((response) => response.json())
        .then((data) => {
            data = data.feeds
            if (data) {
                data.forEach(datapoint => {
                    graph.data.labels.push(graph.data.labels[graph.data.labels.length - 1])
                    graph.data.datasets[0].data.push(datapoint.field1)
                })
            }
            graph.update();
            time = getFormattedDate()
        })
        .catch((error) => {
            console.log('Error: ', error)
        })
}