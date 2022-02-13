import * as React from "react";
import { hot } from "react-hot-loader";
import { Form, Input, InputNumber } from 'antd';
const reactLogo = require("./../assets/img/react_logo.svg");
import "./../assets/scss/App.scss";
import sha256, { Hash, HMAC } from "fast-sha256";
import { Button, Slider } from 'antd';
import { Scatter, getDatasetAtEvent, getElementAtEvent } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
interface IState {
  xMin: number;
  xMax: number;
  baseValue: bigint;
  deltaplus: bigint;

  xAxisValues: string[];
  yAxisValues: string[];
  labelValues: string[];
  xData: number[];
  yData: number[];
}
const YMAX = 65535;
const MAX_PTS = 1000;
const txtencoder = new TextEncoder();

function bnToBuf(bn) {
  var hex = bn.toString(16);
  if (hex.length % 2) { hex = '0' + hex; }

  var len = hex.length / 2;
  var u8 = new Uint8Array(len);

  var i = 0;
  var j = 0;
  while (i < len) {
    u8[i] = parseInt(hex.slice(j, j + 2), 16);
    i += 1;
    j += 2;
  }

  return u8;
}

function bufToBn(buf) {
  var hex = [];
  var u8 = Uint8Array.from(buf);

  u8.forEach(function (i) {
    var h = i.toString(16);
    if (h.length % 2) { h = '0' + h; }
    hex.push(h);
  });

  return BigInt('0x' + hex.join(''));
}

function strToBn(str) {
  return bufToBn(txtencoder.encode(str));
}

const RANGESLIDER_MAX = 100000;

class App extends React.Component<Record<string, unknown>, IState> {
  plotRef;

  constructor(props) {
    super(props);
    this.state = {
      // graph params
      xMin: 0, xMax: 1,
      baseValue: strToBn('testvalue123'), deltaplus: 5000n,

      // calc'ed values
      xAxisValues: [0, 1, 2, 3, 4, 5, 6, 7].map(x => x.toString()),
      yAxisValues: [0, 1, 2, 3, 4, 5, 6, 7].map(x => x.toString()),
      labelValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      xData: [1, 2, 3, 4, 5, 6, 250],
      yData: [1, 3, 4222, 5, 955, 2, 4444]

    };

    // This binding is necessary to make `this` work in the callback
    this.handleChanged = this.handleChanged.bind(this);
    this.xAxisCallback = this.xAxisCallback.bind(this);
    this.yAxisCallback = this.yAxisCallback.bind(this);
    this.labelCallback = this.labelCallback.bind(this);
    this.onFormFinish = this.onFormFinish.bind(this);

    this.SetGraphBase = this.SetGraphBase.bind(this);
    this.SetGraphRange = this.SetGraphRange.bind(this);
    this.RecalcGraphPts = this.RecalcGraphPts.bind(this);


    this.onGraphClick = this.onGraphClick.bind(this);
    this.plotRef = React.createRef();
    // console.log(sha256(new Uint8Array([4, 2, 6, 7])))
  }

  shouldComponentUpdate(nextProps: Readonly<Record<string, unknown>>, nextState: Readonly<IState>, nextContext: any): boolean {
    return this.state.labelValues != nextState.labelValues;
  }

  SetGraphBase(baseValue: string, deltaplus: number) {
    this.setState({
      baseValue: strToBn(baseValue),
      deltaplus: BigInt(deltaplus)
    }, this.RecalcGraphPts)
  }

  SetGraphRange(minRatio, maxRatio) {
    this.setState({
      xMin: minRatio,
      xMax: maxRatio
    }, this.RecalcGraphPts)

  }

  RecalcGraphPts() {
    // calculate real x-axis positions and target values[ basically the range between 0-MAX_PTS-1 ]
    const { baseValue, deltaplus, xMin, xMax } = this.state;

    const deltaFragmentCount = 5000;
    var deltaPiece: bigint = deltaplus > deltaFragmentCount ? deltaplus / BigInt(deltaFragmentCount) : BigInt(1);
    var xDelta = xMax - xMin;
    console.log(deltaPiece)
    var xValues = [];
    var yValues = [];
    var labelValues = [];
    var xValuesRaw = []
    for (var i = 0; i < MAX_PTS; i++) {
      var deltaProgRatio = xMin + xDelta * (i / MAX_PTS);
      var deltaPieceCount = BigInt(Math.round(deltaFragmentCount * deltaProgRatio));

      var xValueRaw = baseValue + (deltaPiece * deltaPieceCount);
      var hashedResult = sha256(bnToBuf(xValueRaw));

      var yValue = hashedResult[0] * 256 + hashedResult[1];
      xValuesRaw.push(xValueRaw);
      xValues.push(i);
      yValues.push(yValue);

      //labelValues.push("SHA256(0x" + xValueRaw.toString(16) + ") = " + bufToBn(hashedResult).toString(16) + "   dispvalue = " + (yValue));
      labelValues.push("SHA256(0x" + xValueRaw.toString(16) + ") = " + bufToBn(hashedResult).toString(16).padStart(64, '0'));
    }
    // console.log(xValues,yValues,labelValues)
    this.setState({
      xData: xValues, yData: yValues, labelValues: labelValues
    });
    //console.log("Min XValue: " + xValuesRaw[0].toString());
    //console.log("Max XValue: " + xValuesRaw[xValuesRaw.length-1].toString())


    // calculate real y-axis positions [ the SHA value of base + incremental deltaplus ]
    // calculate the label values - the original and SHA value of the base + incremental deltaplus



  }

  handleChanged(values) {
    this.SetGraphRange(values[0] / RANGESLIDER_MAX, values[1] / RANGESLIDER_MAX);
  }

  labelCallback = function (ctx) {
    // console.log(ctx);

    let label = this.state.labelValues[ctx.dataIndex]; // ctx.dataset.label;
    //label += " (" + ctx.parsed.x + ", " + ctx.parsed.y + ")";
    return label;
  }

  xAxisCallback = function (value, index, ticks) {
    return index % 2 === 0 ? this.state.xAxisValues[index] : '';
  };

  yAxisCallback = function (value, index, ticks) {
    return index % 2 === 0 ? this.state.yAxisValues[index] : '';
  }

  onFormFinish = (values: any) => {

    // console.log('Received values of form: ', values);
    this.SetGraphBase(values.xbase, values.deltaplus);
  };

  onGraphClick = (event) => {
    var evts = getElementAtEvent(this.plotRef.current, event);
    if (evts.length == 0) return;
    //console.log(getElementAtEvent(this.plotRef.current, event)[0].index)
    console.log(this.state.labelValues[evts[0].index]);
    //this.state.labelValues[getElementAtEvent(this.plotRef.current, event)[0].index];
  }

  public render() {
    const { xData, yData } = this.state;

    const data = {
      labels: xData,
      datasets: [{
        id: 1,
        label: 'My First dataset',
        backgroundColor: 'rgb(0,0,0)',
        borderColor: 'rgb(0,0,0)',
        data: yData,
      }]
    }

    return (
      <div className="app" style={{ margin: '20px 20px 20px 20px' }}>

        <div style={{ position: 'relative', height: '70vh' }}>
          <Scatter datasetIdKey='id' data={data} onClick={this.onGraphClick} ref={this.plotRef}
            options={{
              maintainAspectRatio: false,
              plugins: {
                tooltip: {
                  callbacks: {
                    label: this.labelCallback
                  }
                },
                legend: {
                  display: false
                }
              },
              scales: {
                xAxes: {
                  max: MAX_PTS - 1,
                  min: 0

                },
                yAxes: {
                  max: YMAX,
                  min: 0,
                  display: true,
                  type: "logarithmic"
                },
                /*x: {
                  ticks: {
                    // Include a dollar sign in the ticks
                    callback: this.xAxisCallback,
  
                  }
                },
                y: {
                  ticks: {
                    // Include a dollar sign in the ticks
                    callback: this.yAxisCallback,
                  }
                }
  */
              },

            }} />
        </div>
        <div style={{ margin: '20px 20px 20px 20px', position: 'relative' }}>
          <Slider range defaultValue={[0, RANGESLIDER_MAX]} disabled={false} min={0} max={RANGESLIDER_MAX} onChange={this.handleChanged} />
        </div>
        <div style={{ margin: '20px 20px 20px 20px', position: 'relative' }}>
          <Form
            name="basic"
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            initialValues={{ remember: true }}
            onFinish={this.onFormFinish}
            autoComplete="off"
          >
            <Form.Item
              label="xbase"
              name="xbase"
              initialValue={'testvalue123'}
            >
              <Input />
            </Form.Item>

            <Form.Item
              label="deltaplus"
              name="deltaplus"
              initialValue={5000}
            >
              <InputNumber />
            </Form.Item>

           {/* <Form.Item
              label="thresholdzeroes"
              name="thresholdzeroes"
              initialValue={2}
            >
              <InputNumber />
            </Form.Item>*/ }


            <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
              <Button type="primary" htmlType="submit">
                ENTRY
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div >
    );
  }
}

declare let module: Record<string, unknown>;

export default hot(module)(App);

/**
 *  <h1>Hello World!</h1>
        <p>Foo to the barz</p>
        <img src={reactLogo.default} height="480" />
 * 
 */